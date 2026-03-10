import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { metaApiGet, activeFilter, AD_DEFAULT_FIELDS } from "../meta/client.js";
import type { MetaListResponse, MetaAd } from "../meta/types.js";

export function registerGetMetaAds(server: McpServer): void {
  server.tool(
    "get_meta_ads",
    "List ads from a Meta ad account, optionally scoped to an ad set. Defaults to active ads with lean field set.",
    {
      ad_account_id: z
        .string()
        .describe("Meta ad account ID (e.g. act_123456789)"),
      adset_id: z
        .string()
        .optional()
        .describe("Scope to a specific ad set ID."),
      fields: z
        .string()
        .optional()
        .describe(`Comma-separated fields. Default: ${AD_DEFAULT_FIELDS}`),
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
    async ({ ad_account_id, adset_id, fields, effective_status, limit, after }) => {
      try {
        const params: Record<string, string> = {
          fields: fields ?? AD_DEFAULT_FIELDS,
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

        const parentPath = adset_id
          ? `/${adset_id}/ads`
          : `/${ad_account_id}/ads`;

        const result = await metaApiGet<MetaListResponse<MetaAd>>({
          path: parentPath,
          params,
        });

        const ads = result.data.data;
        const nextCursor = result.data.paging?.cursors?.after;

        let text = `Found ${ads.length} ads:\n\n`;
        for (const ad of ads) {
          text +=
            `- **${ad.name}** (${ad.id})\n` +
            `  Ad Set: ${ad.adset_id} | Status: ${ad.effective_status}` +
            (ad.creative?.call_to_action_type
              ? ` | CTA: ${ad.creative.call_to_action_type}`
              : "") +
            (ad.creative?.video_id ? " | Format: Video" : "") +
            (ad.creative?.image_url ? " | Format: Image" : "") +
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
