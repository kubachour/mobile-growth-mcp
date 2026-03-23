import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { googleAdsQuery } from "../google/client.js";
import { formatMicros } from "../google/format.js";
import type { GoogleAdsRow } from "../google/types.js";

function channelSubTypeLabel(subType?: string): string {
  if (subType === "APP_CAMPAIGN") return "ACi";
  if (subType === "APP_CAMPAIGN_FOR_ENGAGEMENT") return "ACe";
  return subType ?? "—";
}

function appStoreLabel(appStore?: string): string {
  if (appStore === "APPLE_APP_STORE") return "iOS";
  if (appStore === "GOOGLE_APP_STORE") return "Android";
  return appStore ?? "";
}

function biddingGoalLabel(goal?: string): string {
  if (goal === "OPTIMIZE_INSTALLS_TARGET_INSTALL_COST") return "Installs";
  if (goal === "OPTIMIZE_IN_APP_CONVERSIONS_TARGET_INSTALL_COST") return "In-App Actions";
  if (goal === "OPTIMIZE_IN_APP_CONVERSIONS_TARGET_CONVERSION_COST") return "In-App Actions";
  if (goal === "OPTIMIZE_RETURN_ON_ADVERTISING_SPEND") return "ROAS";
  if (goal === "OPTIMIZE_PRE_REGISTRATION_CONVERSION_VOLUME") return "Pre-Reg";
  return goal ?? "—";
}

function formatTarget(row: GoogleAdsRow): string {
  const c = row.campaign;
  if (!c) return "—";
  if (c.targetCpa?.targetCpaMicros) {
    return formatMicros(c.targetCpa.targetCpaMicros);
  }
  if (c.targetRoas?.targetRoas !== undefined) {
    return `${(c.targetRoas.targetRoas * 100).toFixed(0)}%`;
  }
  return "—";
}

export function registerGetGoogleAdsCampaigns(server: McpServer): void {
  server.tool(
    "get_google_ads_campaigns",
    "List Google App Campaigns with status, bid strategy, budgets, and app info. Campaign naming conventions encode dimensions (app, event, country, OS) — surface the raw name for parsing. Requires Google Ads credentials — run `npx mobile-growth-mcp auth google` to set up.",
    {
      customer_id: z
        .string()
        .describe("Google Ads customer ID (e.g. 123-456-7890 or 1234567890)"),
      status: z
        .array(z.enum(["ENABLED", "PAUSED", "REMOVED"]))
        .optional()
        .describe('Filter by campaign status. Default: ["ENABLED"]'),
      channel_sub_type: z
        .array(z.enum(["APP_CAMPAIGN", "APP_CAMPAIGN_FOR_ENGAGEMENT"]))
        .optional()
        .describe('Filter by sub-type. Default: ["APP_CAMPAIGN", "APP_CAMPAIGN_FOR_ENGAGEMENT"]. Set to include all app campaign types'),
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Max campaigns to return (default 50)"),
    },
    async ({ customer_id, status, channel_sub_type, limit }) => {
      try {
        const statuses = status ?? ["ENABLED"];
        const subTypes = channel_sub_type ?? ["APP_CAMPAIGN", "APP_CAMPAIGN_FOR_ENGAGEMENT"];
        const rowLimit = limit ?? 50;

        const statusList = statuses.map((s) => `'${s}'`).join(", ");
        const subTypeList = subTypes.map((s) => `'${s}'`).join(", ");

        const query = `
          SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            campaign.advertising_channel_type,
            campaign.advertising_channel_sub_type,
            campaign.bidding_strategy_type,
            campaign.target_cpa.target_cpa_micros,
            campaign.target_roas.target_roas,
            campaign.campaign_budget,
            campaign_budget.amount_micros,
            campaign_budget.type,
            campaign.app_campaign_setting.app_id,
            campaign.app_campaign_setting.app_store,
            campaign.app_campaign_setting.bidding_strategy_goal_type,
            campaign.start_date,
            campaign.end_date
          FROM campaign
          WHERE campaign.advertising_channel_type = 'MULTI_CHANNEL'
            AND campaign.advertising_channel_sub_type IN (${subTypeList})
            AND campaign.status IN (${statusList})
          LIMIT ${rowLimit}
        `;

        const chunks = await googleAdsQuery(customer_id, query);
        const rows: GoogleAdsRow[] = chunks.flatMap((c) => c.results ?? []);

        if (rows.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No campaigns found matching filters. Try expanding status filter to include PAUSED.",
              },
            ],
          };
        }

        const header = `## Google Campaigns (${rows.length} found)\n\n`;
        const tableHeader =
          "| Campaign | Status | Type | Bid Strategy | Target | Daily Budget | App |\n" +
          "|---|---|---|---|---|---|---|\n";

        let tableRows = "";
        for (const row of rows) {
          const c = row.campaign;
          if (!c) continue;

          const budget = row.campaignBudget?.amountMicros
            ? formatMicros(row.campaignBudget.amountMicros)
            : "—";
          const budgetType = row.campaignBudget?.type;
          const budgetDisplay = budgetType === "TOTAL" ? `${budget} (lifetime)` : budget;

          const appId = c.appCampaignSetting?.appId ?? "";
          const store = appStoreLabel(c.appCampaignSetting?.appStore);
          const appDisplay = appId ? `${appId} (${store})` : "—";

          tableRows +=
            `| ${c.name} | ${c.status} | ${channelSubTypeLabel(c.advertisingChannelSubType)} ` +
            `| ${c.biddingStrategyType ?? "—"} | ${formatTarget(row)} ` +
            `| ${budgetDisplay} | ${appDisplay} |\n`;
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
