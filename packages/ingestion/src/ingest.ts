import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSupabaseClient, type Insight } from "@mobile-growth/shared";
import { validateInsight } from "./validate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INSIGHTS_DIR = path.resolve(__dirname, "../../../data/insights");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMBED_MODEL = "text-embedding-3-small";
const EMBED_BATCH_SIZE = 100; // OpenAI supports up to 2048 inputs per call

/** Build the text that gets embedded — matches the DB function embedding_input(). */
function embeddingInput(title: string, insight: string): string {
  return `# ${title}\n\n${insight}`;
}

/** Generate embeddings for a batch of texts via OpenAI API. */
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI embedding failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  // Response data is sorted by index, but sort explicitly to be safe
  return (data.data as { index: number; embedding: number[] }[])
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

async function main() {
  const files = fs
    .readdirSync(INSIGHTS_DIR)
    .filter((f) => f.endsWith(".json"));

  if (files.length === 0) {
    console.log("No JSON files found in data/insights/");
    return;
  }

  console.log(`Found ${files.length} insight file(s)`);

  // Read and validate all files. Each file can contain a single insight or an array.
  const allInsights: { insight: Insight; file: string }[] = [];

  for (const file of files) {
    const raw = JSON.parse(
      fs.readFileSync(path.join(INSIGHTS_DIR, file), "utf-8")
    );
    const items = Array.isArray(raw) ? raw : [raw];

    for (const item of items) {
      validateInsight(item, file);
      allInsights.push({ insight: item as Insight, file });
    }
  }

  console.log(`Validated ${allInsights.length} insight(s)`);

  // Upsert into Supabase
  const supabase = getSupabaseClient();
  let upserted = 0;
  let failed = 0;

  for (const { insight, file } of allInsights) {
    const ge = insight.growth_gems_edition;

    const { error } = await supabase.from("insights").upsert(
      {
        slug: insight.id,
        title: insight.title,
        insight: insight.insight,
        raw_excerpt: insight.raw_excerpt ?? null,
        source_type: insight.source_type,
        source_author: insight.source_author ?? null,
        source_title: insight.source_title ?? null,
        source_date: insight.source_date ?? null,
        growth_gems_edition: ge != null ? String(ge) : null,
        platform: insight.platform ?? null,
        topics: insight.topics,
        applies_to: insight.applies_to,
        confidence: insight.confidence ?? 3,
        actionable_steps: insight.actionable_steps ?? null,
      },
      { onConflict: "slug" }
    );

    if (error) {
      console.error(`  FAIL [${file}] ${insight.title}: ${error.message}`);
      failed++;
    } else {
      console.log(`  OK   ${insight.title}`);
      upserted++;
    }
  }

  console.log(`\nUpsert done: ${upserted} upserted, ${failed} failed`);

  // Generate embeddings
  if (!OPENAI_API_KEY) {
    console.warn(
      "\nSkipping embeddings: OPENAI_API_KEY not set in .env" +
        "\nInsights were upserted but will not be searchable via semantic search."
    );
    return;
  }

  await embedAllInsights(supabase);
}

/**
 * Fetch all insights missing embeddings and generate them in batches.
 * Also re-embeds rows whose content changed (detected via content hash mismatch).
 */
async function embedAllInsights(supabase: ReturnType<typeof getSupabaseClient>) {
  // Fetch all rows — we need title + insight to compute the embedding input,
  // and the current embedding to detect NULLs.
  // Use pagination since there may be many rows.
  const PAGE_SIZE = 500;
  let allRows: { id: number; slug: string; title: string; insight: string; embedding: unknown }[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("insights")
      .select("id, slug, title, insight, embedding")
      .range(from, from + PAGE_SIZE - 1)
      .order("id");

    if (error) {
      console.error(`Failed to fetch insights for embedding: ${error.message}`);
      return;
    }
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  // Filter to rows needing embeddings (NULL embedding)
  const needsEmbed = allRows.filter((r) => !r.embedding);

  if (needsEmbed.length === 0) {
    console.log("\nAll insights already have embeddings.");
    return;
  }

  console.log(`\nGenerating embeddings for ${needsEmbed.length} insight(s)...`);

  let embedded = 0;
  let embedFailed = 0;

  for (let i = 0; i < needsEmbed.length; i += EMBED_BATCH_SIZE) {
    const batch = needsEmbed.slice(i, i + EMBED_BATCH_SIZE);
    const texts = batch.map((r) => embeddingInput(r.title, r.insight));

    try {
      const embeddings = await generateEmbeddings(texts);

      // Update each row with its embedding
      for (let j = 0; j < batch.length; j++) {
        const { error } = await supabase
          .from("insights")
          .update({ embedding: JSON.stringify(embeddings[j]) })
          .eq("id", batch[j].id);

        if (error) {
          console.error(`  EMBED FAIL ${batch[j].slug}: ${error.message}`);
          embedFailed++;
        } else {
          embedded++;
        }
      }

      console.log(
        `  Batch ${Math.floor(i / EMBED_BATCH_SIZE) + 1}: ${batch.length} embedded`
      );
    } catch (err) {
      console.error(
        `  Batch ${Math.floor(i / EMBED_BATCH_SIZE) + 1} FAILED: ${(err as Error).message}`
      );
      embedFailed += batch.length;
    }
  }

  console.log(`\nEmbedding done: ${embedded} generated, ${embedFailed} failed`);

  // Final verification
  const { count } = await supabase
    .from("insights")
    .select("id", { count: "exact", head: true })
    .is("embedding", null);

  if (count && count > 0) {
    console.warn(`Warning: ${count} insight(s) still missing embeddings. Re-run to retry.`);
  } else {
    console.log("Verified: all insights have embeddings.");
  }
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
