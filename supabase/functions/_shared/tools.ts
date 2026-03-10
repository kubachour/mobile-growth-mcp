import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

// --- Embedding helper ---

async function embedQuery(query: string): Promise<number[]> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: query,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding generation failed: ${err}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

// --- Tool definitions ---

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  adminOnly?: boolean;
  handler: (
    args: Record<string, unknown>,
    supabase: SupabaseClient
  ) => Promise<{ type: string; text: string }[]>;
}

export const tools: ToolDef[] = [
  {
    name: "search_insights",
    description:
      "Search the mobile advertising knowledge base using hybrid semantic + keyword search. Returns insights from industry experts about campaign optimization, creative strategy, audience targeting, scaling, and more.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural language search query" },
        topics: {
          type: "array",
          items: { type: "string" },
          description:
            "Filter by topic tags, e.g. ['creative_strategy', 'scaling']",
        },
        applies_to: {
          type: "array",
          items: { type: "string" },
          description:
            "Filter by applicability, e.g. ['subscription_apps', 'ios']",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default 10, max 30)",
        },
      },
      required: ["query"],
    },
    handler: async (args, supabase) => {
      const query = args.query as string;
      const topics = (args.topics as string[] | undefined) ?? null;
      const applies_to = (args.applies_to as string[] | undefined) ?? null;
      const limit = Math.min((args.limit as number | undefined) ?? 10, 30);

      const embedding = await embedQuery(query);

      const { data, error } = await supabase.rpc("hybrid_search_insights", {
        query_text: query,
        query_embedding: JSON.stringify(embedding),
        match_count: limit,
        filter_topics: topics,
        filter_applies_to: applies_to,
      });

      if (error) throw new Error(`Search failed: ${error.message}`);

      if (!data || data.length === 0) {
        return [
          {
            type: "text",
            text: `No insights found for "${query}". Try a broader query or different topic filters.`,
          },
        ];
      }

      const formatted = data
        .map(
          (d: Record<string, unknown>) =>
            `## ${d.title}\n` +
            `**ID:** ${d.slug} | **Source:** ${d.source_author ?? "Unknown"} (${d.source_type})` +
            (d.platform ? ` | **Platform:** ${d.platform}` : "") +
            "\n" +
            `**Topics:** ${(d.topics as string[]).join(", ")}\n` +
            `**Confidence:** ${d.confidence}/5 | **Score:** ${(d.score as number).toFixed(3)}\n\n` +
            `${d.insight}\n` +
            (d.actionable_steps
              ? `\n**Actionable Steps:**\n${(d.actionable_steps as string[]).map((s) => `- ${s}`).join("\n")}`
              : "")
        )
        .join("\n\n---\n\n");

      return [
        {
          type: "text",
          text: `Found ${data.length} insights for "${query}":\n\n${formatted}`,
        },
      ];
    },
  },

  {
    name: "list_insights",
    adminOnly: true,
    description:
      "Returns titles and metadata for all insights in the knowledge base. Use this to browse available knowledge or to reason across all insights and find cross-topic connections.",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Filter by a single topic tag",
        },
        applies_to: {
          type: "string",
          description: "Filter by a single applies_to value",
        },
      },
    },
    handler: async (args, supabase) => {
      const topic = (args.topic as string | undefined) ?? null;
      const applies_to = (args.applies_to as string | undefined) ?? null;

      const { data, error } = await supabase.rpc("list_insights", {
        filter_topic: topic,
        filter_applies_to_value: applies_to,
      });

      if (error) throw new Error(`List failed: ${error.message}`);

      const formatted = (data as Record<string, unknown>[])
        .map(
          (d) =>
            `- **[${d.slug}]** ${d.title} | ${d.source_author ?? "Unknown"} (${d.source_type})` +
            (d.platform ? ` | ${d.platform}` : "") +
            ` | Topics: ${(d.topics as string[]).join(", ")} | ${d.confidence}/5`
        )
        .join("\n");

      return [
        {
          type: "text",
          text: `${(data as unknown[]).length} insights in knowledge base:\n\n${formatted}`,
        },
      ];
    },
  },

  {
    name: "get_vocabulary_counts",
    description:
      "Returns counts of how many insights use each topic and applies_to tag. Lightweight alternative to list_insights for vocabulary/tag exploration.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async (_args, supabase) => {
      const { data, error } = await supabase
        .from("insights")
        .select("topics, applies_to");

      if (error) throw new Error(`Vocabulary counts failed: ${error.message}`);

      const topics: Record<string, number> = {};
      const applies_to: Record<string, number> = {};

      for (const row of data as { topics: string[]; applies_to: string[] }[]) {
        for (const t of row.topics ?? []) {
          topics[t] = (topics[t] ?? 0) + 1;
        }
        for (const a of row.applies_to ?? []) {
          applies_to[a] = (applies_to[a] ?? 0) + 1;
        }
      }

      return [
        {
          type: "text",
          text: JSON.stringify({ topics, applies_to }),
        },
      ];
    },
  },

  {
    name: "get_insight",
    description:
      "Returns the full content of a specific insight by ID (numeric) or slug (string), including raw excerpt from the original source.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          oneOf: [{ type: "number" }, { type: "string" }],
          description: "The insight numeric ID or string slug",
        },
      },
      required: ["id"],
    },
    handler: async (args, supabase) => {
      const id = args.id as string | number;

      const query = supabase
        .from("insights")
        .select(
          "id, slug, title, insight, raw_excerpt, source_type, source_author, source_title, source_date, growth_gems_edition, platform, topics, applies_to, confidence, actionable_steps, created_at"
        );

      const { data, error } =
        typeof id === "number"
          ? await query.eq("id", id).single()
          : await query.eq("slug", id).single();

      if (error)
        throw new Error(`Error fetching insight ${id}: ${error.message}`);

      const text =
        `# ${data.title}\n\n` +
        `**ID:** ${data.slug}\n` +
        `**Source:** ${data.source_author ?? "Unknown"} — ${data.source_title ?? "N/A"} (${data.source_type})\n` +
        `**Date:** ${data.source_date ?? "Unknown"}\n` +
        (data.platform ? `**Platform:** ${data.platform}\n` : "") +
        (data.growth_gems_edition
          ? `**Growth Gems:** ${data.growth_gems_edition}\n`
          : "") +
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

      return [{ type: "text", text }];
    },
  },
];
