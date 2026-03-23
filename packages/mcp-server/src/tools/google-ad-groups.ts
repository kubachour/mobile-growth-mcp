import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { googleAdsQuery } from "../google/client.js";
import { resolveCampaignId } from "../google/format.js";
import type { GoogleAdsRow } from "../google/types.js";

export function registerGetGoogleAdsAdGroups(server: McpServer): void {
  server.tool(
    "get_google_ad_groups",
    "List ad groups within Google App Campaigns. In UAC, ad groups represent creative themes (e.g. 'at_home_workouts'). The algorithm allocates spend across ad groups based on which themes resonate — observe spend distribution to identify winning messaging angles. To scale, add new ad groups with different text-asset strategies rather than aggressively increasing bids (ab-pt-006).",
    {
      customer_id: z
        .string()
        .describe("Google Ads customer ID (e.g. 123-456-7890 or 1234567890)"),
      campaign_id: z
        .string()
        .optional()
        .describe("Scope to a specific campaign. If omitted, returns ad groups across all app campaigns"),
      status: z
        .array(z.enum(["ENABLED", "PAUSED", "REMOVED"]))
        .optional()
        .describe('Filter by ad group status. Default: ["ENABLED"]'),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Max results to return (default 50)"),
    },
    async ({ customer_id, campaign_id, status, limit }) => {
      try {
        const statuses = status ?? ["ENABLED"];
        const rowLimit = limit ?? 50;
        const statusList = statuses.map((s) => `'${s}'`).join(", ");

        let whereClause =
          `WHERE campaign.advertising_channel_sub_type IN ('APP_CAMPAIGN', 'APP_CAMPAIGN_FOR_ENGAGEMENT')` +
          `\n  AND ad_group.status IN (${statusList})`;

        if (campaign_id) {
          const resolvedCampaignId = await resolveCampaignId(customer_id, campaign_id);
          whereClause += `\n  AND campaign.id = ${resolvedCampaignId}`;
        }

        const query = `
          SELECT
            ad_group.id,
            ad_group.name,
            ad_group.status,
            ad_group.type,
            campaign.id,
            campaign.name,
            campaign.status
          FROM ad_group
          ${whereClause}
          LIMIT ${rowLimit}
        `;

        const chunks = await googleAdsQuery(customer_id, query);
        const rows: GoogleAdsRow[] = chunks.flatMap((c) => c.results ?? []);

        if (rows.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No ad groups found matching filters. Try expanding status filter to include PAUSED.",
              },
            ],
          };
        }

        const campaignName = campaign_id && rows[0]?.campaign?.name
          ? ` for "${rows[0].campaign.name}"`
          : "";
        const header = `## Ad Groups${campaignName} (${rows.length} found)\n\n`;
        const tableHeader =
          "| Ad Group ID | Ad Group | Status | Type | Campaign ID | Campaign |\n" +
          "|---|---|---|---|---|---|\n";

        let tableRows = "";
        for (const row of rows) {
          const ag = row.adGroup;
          const c = row.campaign;
          if (!ag) continue;
          tableRows += `| ${ag.id} | ${ag.name} | ${ag.status ?? "—"} | ${ag.type ?? "—"} | ${c?.id ?? "—"} | ${c?.name ?? "—"} |\n`;
        }

        return {
          content: [{ type: "text" as const, text: header + tableHeader + tableRows }],
        };
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
