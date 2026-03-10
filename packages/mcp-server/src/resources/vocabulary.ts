import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabaseClient, TOPICS, APPLIES_TO, VALID_PLATFORMS } from "@mobile-growth/shared";

export function registerVocabularyResource(server: McpServer): void {
  server.resource(
    "vocabulary",
    "vocabulary://tags",
    {
      description:
        "Available topic tags, applies_to tags, and platforms for filtering insights. Includes counts from the database.",
      mimeType: "application/json",
    },
    async () => {
      let topicCounts: Record<string, number> = {};
      let appliesToCounts: Record<string, number> = {};

      try {
        const supabase = getSupabaseClient();

        const { data: topicRows } = await supabase.rpc("list_insights", {
          filter_topic: null,
          filter_applies_to_value: null,
        });

        if (topicRows) {
          for (const row of topicRows as Record<string, unknown>[]) {
            for (const t of row.topics as string[]) {
              topicCounts[t] = (topicCounts[t] ?? 0) + 1;
            }
            for (const a of row.applies_to as string[]) {
              appliesToCounts[a] = (appliesToCounts[a] ?? 0) + 1;
            }
          }
        }
      } catch {
        // Fall back to static vocabulary if DB is unreachable
      }

      const payload = {
        topics: TOPICS.map((t) => ({ tag: t, count: topicCounts[t] ?? 0 })),
        applies_to: APPLIES_TO.map((a) => ({
          tag: a,
          count: appliesToCounts[a] ?? 0,
        })),
        platforms: [...VALID_PLATFORMS],
      };

      return {
        contents: [
          {
            uri: "vocabulary://tags",
            mimeType: "application/json",
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    }
  );
}
