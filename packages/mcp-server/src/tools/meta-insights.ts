import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  metaApiGet,
  activeFilter,
  INSIGHT_DEFAULT_FIELDS,
  DEFAULT_DATE_PRESET,
  getActionValue,
  getCostPerAction,
} from "../meta/client.js";
import type { MetaListResponse, MetaInsightRow } from "../meta/types.js";

export function registerGetMetaInsights(server: McpServer): void {
  server.tool(
    "get_meta_insights",
    "Pull performance insights from a Meta ad account with configurable level, breakdowns, and date range. Default: campaign-level, last 7 days, active only. Conversion event is configurable (default: mobile_app_install).",
    {
      ad_account_id: z
        .string()
        .describe("Meta ad account ID (e.g. act_123456789)"),
      level: z
        .enum(["account", "campaign", "adset", "ad"])
        .optional()
        .describe("Aggregation level (default: campaign)"),
      fields: z
        .string()
        .optional()
        .describe(
          `Comma-separated fields. Default: ${INSIGHT_DEFAULT_FIELDS}`
        ),
      date_preset: z
        .string()
        .optional()
        .describe(`Date preset (default: ${DEFAULT_DATE_PRESET})`),
      time_range: z
        .object({
          since: z.string().describe("Start date YYYY-MM-DD"),
          until: z.string().describe("End date YYYY-MM-DD"),
        })
        .optional()
        .describe("Custom date range. Overrides date_preset if provided."),
      time_increment: z
        .string()
        .optional()
        .describe(
          'Time granularity: "1" for daily, "7" for weekly, "monthly", or "all_days" (default: aggregated)'
        ),
      breakdowns: z
        .string()
        .optional()
        .describe(
          "Comma-separated breakdowns (e.g. age,gender or publisher_platform,platform_position)"
        ),
      filtering: z
        .string()
        .optional()
        .describe(
          'JSON filtering array. Default: active only. Pass "[]" to include all statuses.'
        ),
      conversion_event: z
        .string()
        .optional()
        .describe(
          "Action type for CPA calculation (default: mobile_app_install)"
        ),
      sort: z
        .string()
        .optional()
        .describe(
          'Sort field (e.g. "spend_descending", "impressions_descending")'
        ),
      limit: z
        .number()
        .min(1)
        .max(500)
        .optional()
        .describe("Results per page (default 50, max 500)"),
      after: z
        .string()
        .optional()
        .describe("Pagination cursor from previous response"),
    },
    async ({
      ad_account_id,
      level,
      fields,
      date_preset,
      time_range,
      time_increment,
      breakdowns,
      filtering,
      conversion_event,
      sort,
      limit,
      after,
    }) => {
      try {
        const convEvent = conversion_event ?? "mobile_app_install";
        const params: Record<string, string> = {
          fields: fields ?? INSIGHT_DEFAULT_FIELDS,
          level: level ?? "campaign",
          limit: String(limit ?? 50),
        };

        if (time_range) {
          params.time_range = JSON.stringify(time_range);
        } else {
          params.date_preset = date_preset ?? DEFAULT_DATE_PRESET;
        }

        if (time_increment) {
          params.time_increment = time_increment;
        }

        if (breakdowns) {
          params.breakdowns = breakdowns;
        }

        if (filtering !== undefined) {
          params.filtering = filtering === "[]" ? "[]" : filtering;
        } else {
          params.filtering = activeFilter();
        }

        if (sort) {
          params.sort = sort;
        }

        if (after) {
          params.after = after;
        }

        const result = await metaApiGet<MetaListResponse<MetaInsightRow>>({
          path: `/${ad_account_id}/insights`,
          params,
        });

        const rows = result.data.data;
        const nextCursor = result.data.paging?.cursors?.after;

        if (!rows || rows.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No insight data returned for the given parameters. Try a broader date range or check that active campaigns exist.",
              },
            ],
          };
        }

        // Format as table
        let text = `**${rows.length} rows** | Level: ${level ?? "campaign"} | Event: ${convEvent}\n\n`;

        for (const row of rows) {
          const spend = parseFloat(row.spend || "0");
          const impressions = parseInt(row.impressions || "0");
          const conversions = getActionValue(row.actions, convEvent);
          const cpa = getCostPerAction(row.cost_per_action_type, convEvent);

          // Build label
          const label =
            row.ad_name ??
            row.adset_name ??
            row.campaign_name ??
            row.campaign_id ??
            "Account";

          // Include breakdown dimensions if present
          const breakdownParts: string[] = [];
          if (row.age) breakdownParts.push(`Age: ${row.age}`);
          if (row.gender) breakdownParts.push(`Gender: ${row.gender}`);
          if (row.publisher_platform)
            breakdownParts.push(`Platform: ${row.publisher_platform}`);
          if (row.platform_position)
            breakdownParts.push(`Position: ${row.platform_position}`);
          if (row.country) breakdownParts.push(`Country: ${row.country}`);
          const breakdownStr =
            breakdownParts.length > 0
              ? ` (${breakdownParts.join(", ")})`
              : "";

          // Date range if time_increment is set
          const dateStr =
            time_increment && row.date_start !== row.date_stop
              ? ` [${row.date_start} → ${row.date_stop}]`
              : time_increment
                ? ` [${row.date_start}]`
                : "";

          text +=
            `**${label}**${breakdownStr}${dateStr}\n` +
            `  Spend: $${spend.toFixed(2)} | Impressions: ${impressions.toLocaleString()}` +
            (row.clicks ? ` | Clicks: ${row.clicks}` : "") +
            (row.ctr ? ` | CTR: ${row.ctr}%` : "") +
            (row.cpm ? ` | CPM: $${row.cpm}` : "") +
            (row.frequency ? ` | Freq: ${row.frequency}` : "") +
            (conversions > 0 ? ` | ${convEvent}: ${conversions}` : "") +
            (cpa !== null ? ` | CPA: $${cpa.toFixed(2)}` : "") +
            "\n\n";
        }

        if (nextCursor) {
          text += `_More results available. Pass \`after: "${nextCursor}"\` for next page._\n`;
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
