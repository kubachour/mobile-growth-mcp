import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabaseClient } from "@mobile-growth/shared";

export function registerGetInsight(server: McpServer): void {
  server.tool(
    "get_insight",
    "Returns the full content of a specific insight by ID (numeric) or slug (string), including raw excerpt from the original source.",
    {
      id: z.union([z.number(), z.string()]).describe("The insight numeric ID or string slug"),
    },
    async ({ id }) => {
      const supabase = getSupabaseClient();

      const query = supabase
        .from("insights")
        .select(
          "id, slug, title, insight, raw_excerpt, source_type, source_author, source_title, source_date, growth_gems_edition, platform, topics, applies_to, confidence, actionable_steps, created_at"
        );

      // Look up by numeric id or string slug
      const { data, error } = typeof id === "number"
        ? await query.eq("id", id).single()
        : await query.eq("slug", id).single();

      if (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching insight ${id}: ${error.message}`,
            },
          ],
          isError: true,
        };
      }

      const text =
        `# ${data.title}\n\n` +
        `**ID:** ${data.slug}\n` +
        `**Source:** ${data.source_author ?? "Unknown"} — ${data.source_title ?? "N/A"} (${data.source_type})\n` +
        `**Date:** ${data.source_date ?? "Unknown"}\n` +
        (data.platform ? `**Platform:** ${data.platform}\n` : "") +
        (data.growth_gems_edition ? `**Growth Gems:** ${data.growth_gems_edition}\n` : "") +
        `**Topics:** ${data.topics.join(", ")}\n` +
        `**Applies to:** ${data.applies_to.join(", ")}\n` +
        `**Confidence:** ${data.confidence}/5\n\n` +
        `## Insight\n\n${data.insight}\n\n` +
        (data.actionable_steps
          ? `## Actionable Steps\n\n${data.actionable_steps.map((s: string) => `- ${s}`).join("\n")}\n\n`
          : "") +
        (data.raw_excerpt
          ? `## Original Excerpt\n\n> ${data.raw_excerpt}`
          : "");

      return {
        content: [{ type: "text" as const, text }],
      };
    }
  );
}
