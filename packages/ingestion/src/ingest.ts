import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSupabaseClient, type Insight } from "@mobile-growth/shared";
import { validateInsight } from "./validate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INSIGHTS_DIR = path.resolve(__dirname, "../../../data/insights");

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

  // Upsert into Supabase (embeddings are generated automatically by the embed Edge Function)
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

  console.log(`\nDone: ${upserted} upserted, ${failed} failed`);
  console.log("Embeddings will be generated automatically by the embed Edge Function.");
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
