import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { googleAdsQuery, normalizeCustomerId } from "../google/client.js";
import type { GoogleAdsRow } from "../google/types.js";

export function registerGetGoogleAdsCampaigns(server: McpServer): void {
  server.tool(
    "get_google_ads_campaigns",
    "List campaigns from a Google Ads account with key metrics. Requires Google Ads credentials — run `npx mobile-growth-mcp auth google` to set up.",
    {
      customer_id: z
        .string()
        .describe("Google Ads customer ID (e.g. 123-456-7890 or 1234567890)"),
      status: z
        .enum(["ENABLED", "PAUSED", "REMOVED"])
        .optional()
        .describe("Filter by campaign status. Default: ENABLED"),
      limit: z
        .number()
        .min(1)
        .max(1000)
        .optional()
        .describe("Max campaigns to return (default 50)"),
    },
    async ({ customer_id, status, limit }) => {
      try {
        const statusFilter = status ?? "ENABLED";
        const rowLimit = limit ?? 50;

        const query = `
          SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            campaign.advertising_channel_type,
            campaign.bidding_strategy_type,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.ctr,
            metrics.average_cpc
          FROM campaign
          WHERE campaign.status = '${statusFilter}'
            AND segments.date DURING LAST_7_DAYS
          ORDER BY metrics.cost_micros DESC
          LIMIT ${rowLimit}
        `;

        const chunks = await googleAdsQuery(customer_id, query);
        const rows: GoogleAdsRow[] = chunks.flatMap((c) => c.results ?? []);

        if (rows.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No ${statusFilter.toLowerCase()} campaigns found for customer ${customer_id} in the last 7 days.`,
              },
            ],
          };
        }

        let text = `Found ${rows.length} ${statusFilter.toLowerCase()} campaigns (last 7 days):\n\n`;

        for (const row of rows) {
          const c = row.campaign;
          const m = row.metrics;
          if (!c) continue;

          const cost = m?.costMicros
            ? `$${(parseInt(m.costMicros) / 1_000_000).toFixed(2)}`
            : "$0.00";
          const impressions = m?.impressions ?? "0";
          const clicks = m?.clicks ?? "0";
          const conversions =
            m?.conversions !== undefined ? m.conversions.toFixed(1) : "0";
          const ctr =
            m?.ctr !== undefined ? `${(m.ctr * 100).toFixed(2)}%` : "—";
          const avgCpc = m?.averageCpc
            ? `$${(parseInt(m.averageCpc) / 1_000_000).toFixed(2)}`
            : "—";

          text +=
            `- **${c.name}** (${c.id})\n` +
            `  Status: ${c.status}` +
            (c.advertisingChannelType
              ? ` | Channel: ${c.advertisingChannelType}`
              : "") +
            (c.biddingStrategyType
              ? ` | Bidding: ${c.biddingStrategyType}`
              : "") +
            `\n` +
            `  Spend: ${cost} | Impr: ${impressions} | Clicks: ${clicks} | CTR: ${ctr} | Avg CPC: ${avgCpc} | Conv: ${conversions}\n`;
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
