import { getSupabaseClient } from "@mobile-growth/shared";

async function main() {
  const slugs = process.argv.slice(2);

  if (slugs.length === 0) {
    console.error("Usage: npm run delete -- <slug1> [slug2] ...");
    console.error("Example: npm run delete -- ab-pt-002 mb-li-003");
    process.exit(1);
  }

  const supabase = getSupabaseClient();
  let deleted = 0;
  let notFound = 0;

  for (const slug of slugs) {
    const { data, error } = await supabase
      .from("insights")
      .delete()
      .eq("slug", slug)
      .select("slug");

    if (error) {
      console.error(`  FAIL ${slug}: ${error.message}`);
    } else if (!data || data.length === 0) {
      console.warn(`  SKIP ${slug}: not found in database`);
      notFound++;
    } else {
      console.log(`  OK   deleted ${slug}`);
      deleted++;
    }
  }

  console.log(`\nDone: ${deleted} deleted, ${notFound} not found`);

  if (deleted > 0) {
    console.log(
      "Remember to also remove the insight(s) from data/insights/ to prevent re-ingestion."
    );
  }
}

main().catch((err) => {
  console.error("Delete failed:", err);
  process.exit(1);
});
