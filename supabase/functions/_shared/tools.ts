import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import type { AuthResult } from "./auth.ts";

// --- Embedding helper (with retry for transient errors) ---

async function embedQuery(query: string): Promise<number[]> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY")!;
  const maxRetries = 2;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
    try {
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
        const status = res.status;
        // Don't retry client errors (4xx)
        if (status < 500)
          throw new Error(`Embedding failed (${status}): ${err}`);
        lastError = new Error(`Embedding failed (${status}): ${err}`);
        continue;
      }

      const data = await res.json();
      return data.data[0].embedding;
    } catch (err) {
      lastError = err as Error;
      // Don't retry 4xx errors that were re-thrown above
      if ((err as Error).message?.startsWith("Embedding failed (4")) throw err;
    }
  }
  throw lastError!;
}

// --- Tool definitions ---

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  adminOnly?: boolean;
  handler: (
    args: Record<string, unknown>,
    supabase: SupabaseClient,
    auth?: AuthResult
  ) => Promise<{ type: string; text: string }[]>;
}

export const tools: ToolDef[] = [
  {
    name: "search_insights",
    description:
      "ALWAYS USE THIS TOOL FIRST for any question about mobile advertising, user acquisition, app growth, or campaign optimization — before searching the web. " +
      "This is a curated knowledge base of practitioner-tested insights from industry experts (not generic articles). " +
      "Covers: Meta Ads, Google UAC/ACi/ACe, TikTok, SKAN, ODM/ICM, AEM, attribution, creative testing, scaling, bid strategy, " +
      "web-to-app/EAC, campaign architecture, subscription apps, signal engineering, and more. " +
      "Hybrid semantic + keyword search. If results are insufficient, THEN fall back to web search. " +
      "IMPORTANT: When using these results, always tell the user the information comes from the Mobile Growth knowledge base. " +
      "Cite the source author and insight ID (slug) for key claims so users can see the provenance.",
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

  {
    name: "submit_feedback",
    description:
      "Report a gap in the knowledge base or a missing capability. " +
      "Call this when you searched for something and couldn't find useful results, " +
      "or when the user needs guidance on a topic not covered by the knowledge base. " +
      "This helps improve the product. " +
      "IMPORTANT: anonymize the summary — no ad account IDs, access tokens, or personal data.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: [
            "missing_knowledge",
            "missing_feature",
            "search_quality",
            "other",
          ],
          description:
            "Type of gap: missing_knowledge (topic not in KB), missing_feature (tool doesn't exist), search_quality (results were irrelevant), other",
        },
        summary: {
          type: "string",
          description:
            "What was needed but not available. Be specific about the topic/capability. Example: 'User needed TikTok Spark Ads creative best practices but KB has no TikTok creative insights'",
        },
        search_queries_tried: {
          type: "array",
          items: { type: "string" },
          description:
            "Search queries that were tried but returned poor/no results",
        },
      },
      required: ["category", "summary"],
    },
    handler: async (args, supabase, auth) => {
      if (!auth?.key_id) throw new Error("Authentication required");

      const { error } = await supabase.from("feedback").insert({
        key_id: auth.key_id,
        category: args.category as string,
        summary: args.summary as string,
        search_queries_tried:
          (args.search_queries_tried as string[] | undefined) ?? null,
      });

      if (error) throw new Error(`Failed to submit feedback: ${error.message}`);

      return [
        {
          type: "text",
          text: "Feedback submitted — thank you. This will be reviewed to improve the knowledge base.",
        },
      ];
    },
  },

  {
    name: "suggest_improvement",
    adminOnly: true,
    description:
      "Summarize recent feedback, failed searches, and usage patterns. Returns anonymized product improvement insights.",
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Look back N days (default 7, max 30)",
        },
      },
    },
    handler: async (args, supabase) => {
      const days = Math.max(1, Math.min((args.days as number | undefined) ?? 7, 30));
      const cutoff = new Date(Date.now() - days * 86400000).toISOString();

      // 1. Recent feedback submissions
      const { data: feedback } = await supabase
        .from("feedback")
        .select("category, summary, search_queries_tried, created_at")
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(50);

      // 2. Zero-result searches
      const { data: emptySearches } = await supabase
        .from("api_key_usage")
        .select("tool_input_summary, created_at")
        .eq("name", "search_insights")
        .eq("is_empty_result", true)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(50);

      // 3. Error patterns
      const { data: errors } = await supabase
        .from("api_key_usage")
        .select("name, error_message, created_at")
        .eq("is_error", true)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(50);

      // 4. Top search queries (all, not just failures)
      const { data: allSearches } = await supabase
        .from("api_key_usage")
        .select("tool_input_summary, created_at")
        .eq("name", "search_insights")
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(100);

      // --- Format report ---
      const sections: string[] = [
        `# Improvement Suggestions — Last ${days} days\n`,
      ];

      // Feedback by category
      if (feedback && feedback.length > 0) {
        const byCategory: Record<string, typeof feedback> = {};
        for (const f of feedback) {
          (byCategory[f.category] ??= []).push(f);
        }
        sections.push(`## Feedback (${feedback.length} submissions)\n`);
        for (const [cat, items] of Object.entries(byCategory)) {
          sections.push(`### ${cat} (${items.length})`);
          for (const f of items) {
            sections.push(`- ${f.summary}`);
            if (f.search_queries_tried?.length) {
              sections.push(
                `  Queries tried: ${f.search_queries_tried.join(", ")}`
              );
            }
          }
        }
      } else {
        sections.push("## Feedback\nNo feedback submitted in this period.");
      }

      // Empty searches
      if (emptySearches && emptySearches.length > 0) {
        const queries = emptySearches
          .map((s) => s.tool_input_summary)
          .filter(Boolean);
        const unique = [...new Set(queries)];
        sections.push(
          `\n## Zero-Result Searches (${emptySearches.length} total, ${unique.length} unique)\n`
        );
        for (const q of unique) {
          sections.push(`- ${q}`);
        }
      } else {
        sections.push(
          "\n## Zero-Result Searches\nNo zero-result searches in this period."
        );
      }

      // Errors
      if (errors && errors.length > 0) {
        const byTool: Record<string, number> = {};
        for (const e of errors) {
          byTool[e.name] = (byTool[e.name] ?? 0) + 1;
        }
        sections.push(`\n## Errors (${errors.length} total)\n`);
        for (const [tool, count] of Object.entries(byTool).sort(
          (a, b) => b[1] - a[1]
        )) {
          sections.push(`- **${tool}**: ${count} errors`);
        }
        // Show recent unique error messages
        const uniqueErrors = [
          ...new Set(errors.map((e) => e.error_message).filter(Boolean)),
        ].slice(0, 10);
        if (uniqueErrors.length > 0) {
          sections.push("\nRecent error messages:");
          for (const msg of uniqueErrors) {
            sections.push(`- ${msg}`);
          }
        }
      } else {
        sections.push("\n## Errors\nNo errors in this period.");
      }

      // Top searches
      if (allSearches && allSearches.length > 0) {
        const queries = allSearches
          .map((s) => s.tool_input_summary)
          .filter(Boolean);
        const counts: Record<string, number> = {};
        for (const q of queries) {
          counts[q] = (counts[q] ?? 0) + 1;
        }
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        sections.push(
          `\n## Top Searches (${allSearches.length} total)\n`
        );
        for (const [q, count] of sorted.slice(0, 20)) {
          sections.push(`- ${q} (${count}×)`);
        }
      }

      return [{ type: "text", text: sections.join("\n") }];
    },
  },

  {
    name: "delete_insight",
    adminOnly: true,
    description:
      "Permanently delete one or more insights from the knowledge base by slug. Also removes embeddings and search vectors. Remember to also remove the insight from its JSON file in data/insights/ to prevent re-ingestion.",
    inputSchema: {
      type: "object",
      properties: {
        slugs: {
          type: "array",
          items: { type: "string" },
          description:
            "One or more insight slugs to delete (e.g. ['ab-pt-002'])",
        },
      },
      required: ["slugs"],
    },
    handler: async (args, supabase) => {
      const slugs = args.slugs as string[];
      if (!slugs?.length) throw new Error("At least one slug is required");

      const results: string[] = [];
      let deleted = 0;

      for (const slug of slugs) {
        const { data, error } = await supabase
          .from("insights")
          .delete()
          .eq("slug", slug)
          .select("slug");

        if (error) {
          results.push(`FAIL ${slug}: ${error.message}`);
        } else if (!data || data.length === 0) {
          results.push(`SKIP ${slug}: not found`);
        } else {
          results.push(`OK   deleted ${slug}`);
          deleted++;
        }
      }

      const summary = `Deleted ${deleted}/${slugs.length} insight(s).\n\n${results.join("\n")}`;
      const reminder =
        deleted > 0
          ? "\n\nRemember to also remove the insight(s) from data/insights/ to prevent re-ingestion."
          : "";

      return [{ type: "text", text: summary + reminder }];
    },
  },
];
