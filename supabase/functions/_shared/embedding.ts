import { requireEnv } from "./env.ts";

const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const EMBEDDING_MODEL = "text-embedding-3-small";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

interface OpenAIEmbeddingResponse {
  data?: { embedding?: number[] }[];
}

export async function embedQuery(query: string): Promise<number[]> {
  const openaiKey = requireEnv("OPENAI_API_KEY");
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
    try {
      const res = await fetch(OPENAI_EMBEDDINGS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: EMBEDDING_MODEL, input: query }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!res.ok) {
        const err = await res.text();
        const status = res.status;
        // Don't retry client errors (4xx) — they will not succeed on retry
        if (status < 500) {
          throw new Error(`Embedding failed (${status}): ${err}`);
        }
        lastError = new Error(`Embedding failed (${status}): ${err}`);
        continue;
      }

      const data = (await res.json()) as OpenAIEmbeddingResponse;
      const embedding = data?.data?.[0]?.embedding;
      if (!Array.isArray(embedding)) {
        throw new Error(
          `Embedding response missing data[0].embedding: ${JSON.stringify(data).slice(0, 200)}`
        );
      }
      return embedding;
    } catch (err) {
      lastError = err as Error;
      // Don't retry 4xx client errors that we re-threw above
      if ((err as Error).message?.startsWith("Embedding failed (4")) {
        throw err;
      }
    }
  }
  throw lastError ?? new Error("Embedding failed after retries");
}
