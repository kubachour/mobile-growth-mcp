// Edge Function: process embedding jobs from pgmq queue
// Called automatically by pg_cron via util.process_embeddings()
// Requires env: OPENAI_API_KEY, SUPABASE_DB_URL

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import OpenAI from "jsr:@openai/openai";
import { z } from "npm:zod";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!);

const jobSchema = z.object({
  jobId: z.number(),
  id: z.number(),
  schema: z.string(),
  table: z.string(),
  contentFunction: z.string(),
  embeddingColumn: z.string(),
});

const failedJobSchema = jobSchema.extend({
  error: z.string(),
});

type Job = z.infer<typeof jobSchema>;
type FailedJob = z.infer<typeof failedJobSchema>;

type Row = {
  id: string;
  content: unknown;
};

const QUEUE_NAME = "embedding_jobs";

const EMBED_SECRET = Deno.env.get("EMBED_SECRET");

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("expected POST request", { status: 405 });
  }

  // Validate shared secret (set via `supabase secrets set EMBED_SECRET=...`)
  if (EMBED_SECRET) {
    const provided = req.headers.get("x-embed-secret");
    if (provided !== EMBED_SECRET) {
      return new Response("unauthorized", { status: 401 });
    }
  }

  if (req.headers.get("content-type") !== "application/json") {
    return new Response("expected json body", { status: 400 });
  }

  const parseResult = z.array(jobSchema).safeParse(await req.json());

  if (parseResult.error) {
    return new Response(`invalid request body: ${parseResult.error.message}`, {
      status: 400,
    });
  }

  const pendingJobs = parseResult.data;
  const completedJobs: Job[] = [];
  const failedJobs: FailedJob[] = [];

  async function processJobs() {
    let currentJob: Job | undefined;

    while ((currentJob = pendingJobs.shift()) !== undefined) {
      try {
        await processJob(currentJob);
        completedJobs.push(currentJob);
      } catch (error) {
        failedJobs.push({
          ...currentJob,
          error: error instanceof Error ? error.message : JSON.stringify(error),
        });
      }
    }
  }

  try {
    await Promise.race([processJobs(), catchUnload()]);
  } catch (error) {
    failedJobs.push(
      ...pendingJobs.map((job) => ({
        ...job,
        error: error instanceof Error ? error.message : JSON.stringify(error),
      }))
    );
  }

  console.log("finished processing jobs:", {
    completedJobs: completedJobs.length,
    failedJobs: failedJobs.length,
  });

  return new Response(
    JSON.stringify({ completedJobs, failedJobs }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-completed-jobs": completedJobs.length.toString(),
        "x-failed-jobs": failedJobs.length.toString(),
      },
    }
  );
});

async function generateEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  const [data] = response.data;

  if (!data) {
    throw new Error("failed to generate embedding");
  }

  return data.embedding;
}

async function processJob(job: Job) {
  const { jobId, id, schema, table, contentFunction, embeddingColumn } = job;

  const [row]: [Row] = await sql`
    select
      id,
      ${sql(contentFunction)}(t) as content
    from
      ${sql(schema)}.${sql(table)} t
    where
      id = ${id}
  `;

  if (!row) {
    throw new Error(`row not found: ${schema}.${table}/${id}`);
  }

  if (typeof row.content !== "string") {
    throw new Error(
      `invalid content - expected string: ${schema}.${table}/${id}`
    );
  }

  const embedding = await generateEmbedding(row.content);

  await sql`
    update
      ${sql(schema)}.${sql(table)}
    set
      ${sql(embeddingColumn)} = ${JSON.stringify(embedding)}
    where
      id = ${id}
  `;

  await sql`
    select pgmq.delete(${QUEUE_NAME}, ${jobId}::bigint)
  `;
}

function catchUnload() {
  return new Promise((_resolve, reject) => {
    addEventListener("beforeunload", (ev: any) => {
      reject(new Error(ev.detail?.reason));
    });
  });
}
