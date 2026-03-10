import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getSupabaseKey } from "@mobile-growth/shared";

function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error("Missing SUPABASE_URL environment variable");
  return url;
}

export function registerSearchInsights(server: McpServer): void {
  server.tool(
    "search_insights",
    "Search the mobile advertising knowledge base using hybrid semantic + keyword search. Returns insights from industry experts about campaign optimization, creative strategy, audience targeting, scaling, and more.",
    {
      query: z.string().describe("Natural language search query"),
      topics: z
        .array(z.string())
        .optional()
        .describe(
          "Filter by topic tags, e.g. ['creative_strategy', 'scaling']"
        ),
      applies_to: z
        .array(z.string())
        .optional()
        .describe(
          "Filter by applicability, e.g. ['subscription_apps', 'ios']"
        ),
      limit: z
        .number()
        .min(1)
        .max(30)
        .optional()
        .describe("Maximum number of results (default 10)"),
    },
    async ({ query, topics, applies_to, limit }) => {
      const supabaseUrl = getSupabaseUrl();
      const supabaseKey = getSupabaseKey();

      // Call the search Edge Function which handles embedding + hybrid search server-side
      const response = await fetch(`${supabaseUrl}/functions/v1/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          query,
          topics: topics ?? null,
          applies_to: applies_to ?? null,
          limit: limit ?? 10,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return {
          content: [
            { type: "text" as const, text: `Error searching insights: ${errText}` },
          ],
          isError: true,
        };
      }

      const { results: data } = await response.json();

      if (!data || data.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No insights found for "${query}". Try a broader query or different topic filters.`,
            },
          ],
        };
      }

      const formatted = data
        .map(
          (d: Record<string, unknown>) =>
            `## ${d.title}\n` +
            `**ID:** ${d.slug} | **Source:** ${d.source_author ?? "Unknown"} (${d.source_type})` +
            (d.platform ? ` | **Platform:** ${d.platform}` : "") + "\n" +
            `**Topics:** ${(d.topics as string[]).join(", ")}\n` +
            `**Confidence:** ${d.confidence}/5 | **Score:** ${(d.score as number).toFixed(3)}\n\n` +
            `${d.insight}\n` +
            (d.actionable_steps
              ? `\n**Actionable Steps:**\n${(d.actionable_steps as string[]).map((s) => `- ${s}`).join("\n")}`
              : "")
        )
        .join("\n\n---\n\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${data.length} insights for "${query}":\n\n${formatted}`,
          },
        ],
      };
    }
  );
}
