import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TOPICS, APPLIES_TO, VALID_PLATFORMS } from "@mobile-growth/shared";
import { callRemoteTool } from "../remote-proxy.js";

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
        const apiKey = process.env.API_KEY;
        if (apiKey) {
          const result = await callRemoteTool(apiKey, "get_vocabulary_counts", {});

          if (!result.isError && result.content.length > 0) {
            const counts = JSON.parse(result.content[0].text);
            topicCounts = counts.topics ?? {};
            appliesToCounts = counts.applies_to ?? {};
          }
        }
      } catch {
        // Fall back to static vocabulary (0 counts) if remote call fails
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
