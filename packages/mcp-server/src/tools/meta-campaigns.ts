import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  metaApiGet,
  activeFilter,
  CAMPAIGN_DEFAULT_FIELDS,
} from "../meta/client.js";
import type { MetaListResponse, MetaCampaign } from "../meta/types.js";

export function registerGetMetaCampaigns(server: McpServer): void {
  server.tool(
    "get_meta_campaigns",
    "List campaigns from a Meta ad account. Defaults to active campaigns with lean field set. Returns first page only — use 'after' cursor for next page.",
    {
      ad_account_id: z
        .string()
        .describe("Meta ad account ID (e.g. act_123456789)"),
      fields: z
        .string()
        .optional()
        .describe(
          `Comma-separated fields. Default: ${CAMPAIGN_DEFAULT_FIELDS}`
        ),
      effective_status: z
        .array(z.string())
        .optional()
        .describe(
          'Filter by status. Default: ["ACTIVE"]. Use ["ACTIVE","PAUSED"] for all non-deleted.'
        ),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Results per page (default 50, max 100)"),
      after: z
        .string()
        .optional()
        .describe("Pagination cursor from previous response"),
    },
    async ({ ad_account_id, fields, effective_status, limit, after }) => {
      try {
        const params: Record<string, string> = {
          fields: fields ?? CAMPAIGN_DEFAULT_FIELDS,
          limit: String(limit ?? 50),
        };

        if (effective_status) {
          params.filtering = JSON.stringify([
            {
              field: "effective_status",
              operator: "IN",
              value: effective_status,
            },
          ]);
        } else {
          params.filtering = activeFilter();
        }

        if (after) {
          params.after = after;
        }

        const result = await metaApiGet<MetaListResponse<MetaCampaign>>({
          path: `/${ad_account_id}/campaigns`,
          params,
        });

        const campaigns = result.data.data;
        const nextCursor = result.data.paging?.cursors?.after;

        let text = `Found ${campaigns.length} campaigns:\n\n`;
        for (const c of campaigns) {
          text +=
            `- **${c.name}** (${c.id})\n` +
            `  Status: ${c.effective_status} | Objective: ${c.objective}` +
            (c.bid_strategy ? ` | Bid: ${c.bid_strategy}` : "") +
            (c.daily_budget
              ? ` | Daily: $${(parseInt(c.daily_budget) / 100).toFixed(2)}`
              : "") +
            (c.lifetime_budget
              ? ` | Lifetime: $${(parseInt(c.lifetime_budget) / 100).toFixed(2)}`
              : "") +
            "\n";
        }

        if (nextCursor) {
          text += `\n_More results available. Pass \`after: "${nextCursor}"\` for next page._`;
        }

        if (result.warning) {
          text = `${result.warning}\n\n${text}`;
        }

        return { content: [{ type: "text" as const, text }] };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
