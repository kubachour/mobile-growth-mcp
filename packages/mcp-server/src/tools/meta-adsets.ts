import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  metaApiGet,
  activeFilter,
  ADSET_DEFAULT_FIELDS,
} from "../meta/client.js";
import type { MetaListResponse, MetaAdSet } from "../meta/types.js";

export function registerGetMetaAdSets(server: McpServer): void {
  server.tool(
    "get_meta_adsets",
    "List ad sets from a Meta ad account, optionally scoped to a campaign. Defaults to active ad sets with lean field set.",
    {
      ad_account_id: z
        .string()
        .describe("Meta ad account ID (e.g. act_123456789)"),
      campaign_id: z
        .string()
        .optional()
        .describe(
          "Scope to a specific campaign ID. If provided, fetches ad sets under that campaign."
        ),
      fields: z
        .string()
        .optional()
        .describe(`Comma-separated fields. Default: ${ADSET_DEFAULT_FIELDS}`),
      effective_status: z
        .array(z.string())
        .optional()
        .describe('Filter by status. Default: ["ACTIVE"]'),
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
    async ({
      ad_account_id,
      campaign_id,
      fields,
      effective_status,
      limit,
      after,
    }) => {
      try {
        const params: Record<string, string> = {
          fields: fields ?? ADSET_DEFAULT_FIELDS,
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

        const parentPath = campaign_id
          ? `/${campaign_id}/adsets`
          : `/${ad_account_id}/adsets`;

        const result = await metaApiGet<MetaListResponse<MetaAdSet>>({
          path: parentPath,
          params,
        });

        const adsets = result.data.data;
        const nextCursor = result.data.paging?.cursors?.after;

        let text = `Found ${adsets.length} ad sets:\n\n`;
        for (const a of adsets) {
          text +=
            `- **${a.name}** (${a.id})\n` +
            `  Campaign: ${a.campaign_id} | Status: ${a.effective_status}` +
            (a.optimization_goal ? ` | Goal: ${a.optimization_goal}` : "") +
            (a.bid_strategy ? ` | Bid: ${a.bid_strategy}` : "") +
            (a.daily_budget
              ? ` | Daily: $${(parseInt(a.daily_budget) / 100).toFixed(2)}`
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
