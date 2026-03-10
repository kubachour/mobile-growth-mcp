import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabaseClient } from "@mobile-growth/shared";

export function registerListInsights(server: McpServer): void {
  server.tool(
    "list_insights",
    "Returns titles and metadata for all insights in the knowledge base. Use this to browse available knowledge or to reason across all insights and find cross-topic connections.",
    {
      topic: z
        .string()
        .optional()
        .describe("Filter by a single topic tag"),
      applies_to: z
        .string()
        .optional()
        .describe("Filter by a single applies_to value"),
    },
    async ({ topic, applies_to }) => {
      const supabase = getSupabaseClient();

      const { data, error } = await supabase.rpc("list_insights", {
        filter_topic: topic ?? null,
        filter_applies_to_value: applies_to ?? null,
      });

      if (error) {
        return {
          content: [
            { type: "text" as const, text: `Error listing insights: ${error.message}` },
          ],
          isError: true,
        };
      }

      const formatted = (data as Record<string, unknown>[])
        .map(
          (d) =>
            `- **[${d.slug}]** ${d.title} | ${d.source_author ?? "Unknown"} (${d.source_type})` +
            (d.platform ? ` | ${d.platform}` : "") +
            ` | Topics: ${(d.topics as string[]).join(", ")} | ${d.confidence}/5`
        )
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `${data.length} insights in knowledge base:\n\n${formatted}`,
          },
        ],
      };
    }
  );
}
