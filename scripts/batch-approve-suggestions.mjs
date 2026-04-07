#!/usr/bin/env node

/**
 * Batch approve or reject pending community suggestions.
 *
 * Usage:
 *   node scripts/batch-approve-suggestions.mjs                       # approve all pending
 *   node scripts/batch-approve-suggestions.mjs --ids 38,39,40        # approve specific IDs
 *   node scripts/batch-approve-suggestions.mjs --dry-run             # preview without writing
 *   node scripts/batch-approve-suggestions.mjs --reject --ids 45,46  # reject specific IDs
 *   node scripts/batch-approve-suggestions.mjs --reject --ids 45 --notes "Duplicate of tp-se-004"
 *
 * Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
 * Load from .env: export $(grep -v '^#' .env | grep -v '^$' | xargs)
 */

import https from "https";
import { URL } from "url";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

// --- Parse CLI args ---

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const REJECT = args.includes("--reject");
let IDS = null;
let NOTES = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--ids" && args[i + 1]) {
    IDS = args[i + 1].split(",").map(Number).filter(Boolean);
  }
  if (args[i] === "--notes" && args[i + 1]) {
    NOTES = args[i + 1];
  }
}

if (args.includes("--help") || args.includes("-h")) {
  console.log(`Usage: node scripts/batch-approve-suggestions.mjs [options]

Options:
  --ids 1,2,3     Process only these suggestion IDs (default: all pending)
  --dry-run       Preview what would happen without writing to DB
  --reject        Reject instead of approve
  --notes "..."   Reviewer notes (used for both approve and reject)
  -h, --help      Show this help`);
  process.exit(0);
}

// --- Validate env ---

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
  );
  process.exit(1);
}
if (!REJECT && !OPENAI_KEY) {
  console.error("Error: OPENAI_API_KEY required for approvals (embeddings)");
  process.exit(1);
}

// --- HTTP helpers ---

function supabaseRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}${path}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function generateEmbedding(text) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    });
    const req = https.request(
      {
        hostname: "api.openai.com",
        path: "/v1/embeddings",
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_KEY}`,
          "Content-Type": "application/json",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.data && parsed.data[0]) resolve(parsed.data[0].embedding);
            else
              reject(new Error(`Embedding error: ${data.slice(0, 200)}`));
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function makeSlug(title) {
  return `cs-${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)}`;
}

// --- Main ---

async function main() {
  // Fetch pending suggestions
  let queryPath =
    "/rest/v1/suggested_insights?status=eq.pending&order=id.asc&select=*";
  if (IDS) {
    queryPath = `/rest/v1/suggested_insights?status=eq.pending&id=in.(${IDS.join(",")})&order=id.asc&select=*`;
  }

  const { data: pending } = await supabaseRequest("GET", queryPath);

  if (!Array.isArray(pending) || pending.length === 0) {
    console.log("No pending suggestions found.");
    return;
  }

  const action = REJECT ? "reject" : "approve";
  console.log(
    `Found ${pending.length} pending suggestion(s) to ${action}${DRY_RUN ? " (DRY RUN)" : ""}\n`
  );

  let succeeded = 0;
  let failed = 0;

  for (const s of pending) {
    if (REJECT) {
      // --- Reject ---
      if (DRY_RUN) {
        console.log(`[dry-run] Would reject #${s.id}: ${s.title.slice(0, 80)}`);
        succeeded++;
        continue;
      }

      try {
        await supabaseRequest(
          "PATCH",
          `/rest/v1/suggested_insights?id=eq.${s.id}`,
          {
            status: "rejected",
            reviewer_notes: NOTES ?? "Batch rejected via CLI",
            reviewed_at: new Date().toISOString(),
          }
        );
        succeeded++;
        console.log(`✗ #${s.id} rejected: ${s.title.slice(0, 80)}`);
      } catch (err) {
        failed++;
        console.error(`✗ #${s.id} FAILED: ${err.message}`);
      }
    } else {
      // --- Approve ---
      const slug = makeSlug(s.title);

      if (DRY_RUN) {
        console.log(
          `[dry-run] Would approve #${s.id} → ${slug}`
        );
        succeeded++;
        continue;
      }

      try {
        const embeddingText = `# ${s.title}\n\n${s.insight}`;
        const embedding = await generateEmbedding(embeddingText);

        const insightBody = {
          slug,
          title: s.title,
          insight: s.insight,
          raw_excerpt: s.raw_excerpt,
          source_type: s.source_type,
          source_author: s.source_author,
          source_title: s.source_title,
          source_date: s.source_date,
          platform: s.platform,
          topics: s.topics,
          applies_to: s.applies_to,
          confidence: s.confidence,
          actionable_steps: s.actionable_steps,
          embedding: JSON.stringify(embedding),
          owner_key_id: null,
        };

        const upsertRes = await supabaseRequest(
          "POST",
          "/rest/v1/insights?on_conflict=slug",
          insightBody
        );

        if (upsertRes.status >= 300) {
          throw new Error(
            `Upsert failed (${upsertRes.status}): ${JSON.stringify(upsertRes.data).slice(0, 200)}`
          );
        }

        await supabaseRequest(
          "PATCH",
          `/rest/v1/suggested_insights?id=eq.${s.id}`,
          {
            status: "approved",
            reviewer_notes: NOTES ?? "Batch approved via CLI",
            reviewed_at: new Date().toISOString(),
          }
        );

        succeeded++;
        console.log(`✓ #${s.id} → ${slug}`);
      } catch (err) {
        failed++;
        console.error(`✗ #${s.id} FAILED: ${err.message}`);
      }
    }
  }

  console.log(
    `\nDone: ${succeeded} ${action}ed, ${failed} failed${DRY_RUN ? " (dry run — nothing written)" : ""}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
