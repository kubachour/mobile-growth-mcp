import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { googleAdsQuery } from "../google/client.js";
import { formatMicros, formatPct, formatCompact, datePresetToRange } from "../google/format.js";
import type { GoogleAdsRow } from "../google/types.js";

interface AggRow {
  label: string;
  breakdown?: string;
  date?: string;
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
  conversionsValue: number;
  installs: number;
  postInstalls: number;
  videoViews: number;
  averageCpmMicros: number;
  averageCpcMicros: number;
  rowCount: number;
}

function parseNum(v: string | number | undefined): number {
  if (v === undefined || v === null) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function buildAggKey(row: GoogleAdsRow, level: string, breakdown?: string): string {
  const parts: string[] = [];
  if (level === "campaign" || level === "ad_group" || level === "asset") {
    parts.push(row.campaign?.id ?? "?");
  }
  if (level === "ad_group" || level === "asset") {
    parts.push(row.adGroup?.id ?? "?");
  }
  if (level === "asset") {
    parts.push(row.asset?.id ?? "?");
  }
  if (breakdown) {
    const seg = row.segments;
    if (breakdown === "network") parts.push(seg?.adNetworkType ?? "?");
    if (breakdown === "device") parts.push(seg?.device ?? "?");
  }
  return parts.join("|");
}

function getLabel(row: GoogleAdsRow, level: string): string {
  if (level === "asset") return row.asset?.name ?? row.asset?.id ?? "—";
  if (level === "ad_group") return row.adGroup?.name ?? row.adGroup?.id ?? "—";
  if (level === "campaign") return row.campaign?.name ?? row.campaign?.id ?? "—";
  return "Account";
}

function getBreakdownValue(row: GoogleAdsRow, breakdown?: string): string | undefined {
  if (!breakdown) return undefined;
  const seg = row.segments;
  if (breakdown === "network") return seg?.adNetworkType;
  if (breakdown === "device") return seg?.device;
  return undefined;
}

function sortKeyForEnum(sort: string): string {
  switch (sort) {
    case "cost_desc": return "metrics.cost_micros";
    case "conversions_desc": return "metrics.conversions";
    case "impressions_desc": return "metrics.impressions";
    case "ctr_desc": return "metrics.ctr";
    default: return "metrics.cost_micros";
  }
}

export function registerGetGoogleAdsInsights(server: McpServer): void {
  server.tool(
    "get_google_insights",
    "Pull performance metrics from Google Ads with configurable level, breakdowns, date ranges, and time granularity. Use network breakdown to detect traffic shifts between Search, Display/AdMob, and YouTube — the #1 diagnostic lever for Google campaigns (ab-pt-005). Supports campaign, ad_group, asset, and account levels.",
    {
      customer_id: z
        .string()
        .describe("Google Ads customer ID"),
      level: z
        .enum(["account", "campaign", "ad_group", "asset"])
        .optional()
        .describe("Aggregation level (default: campaign)"),
      campaign_id: z
        .string()
        .optional()
        .describe("Scope to specific campaign"),
      ad_group_id: z
        .string()
        .optional()
        .describe("Scope to specific ad group"),
      breakdown: z
        .enum(["network", "device"])
        .optional()
        .describe("Segmentation dimension. Only one at a time (GAQL restriction)"),
      date_range: z
        .object({
          start_date: z.string().describe("YYYY-MM-DD"),
          end_date: z.string().describe("YYYY-MM-DD"),
        })
        .optional()
        .describe("Custom date range. Overrides date_preset"),
      date_preset: z
        .enum(["LAST_7_DAYS", "LAST_14_DAYS", "LAST_30_DAYS", "THIS_MONTH", "LAST_MONTH"])
        .optional()
        .describe("Predefined date range (default: LAST_7_DAYS)"),
      time_increment: z
        .enum(["daily", "weekly", "monthly", "summary"])
        .optional()
        .describe("Time granularity (default: summary)"),
      sort: z
        .enum(["cost_desc", "conversions_desc", "impressions_desc", "ctr_desc"])
        .optional()
        .describe("Sort order (default: cost_desc)"),
      limit: z
        .number()
        .min(1)
        .max(500)
        .optional()
        .describe("Max results (default 50)"),
    },
    async ({ customer_id, level, campaign_id, ad_group_id, breakdown, date_range, date_preset, time_increment, sort, limit }) => {
      try {
        const lvl = level ?? "campaign";
        const ti = time_increment ?? "summary";
        const sortField = sort ?? "cost_desc";
        const rowLimit = limit ?? 50;

        // Resolve date range
        const dr = date_range ?? datePresetToRange(date_preset ?? "LAST_7_DAYS");
        const dateLabel = date_range
          ? `${dr.start_date ?? dr.start} to ${dr.end_date ?? dr.end}`
          : (date_preset ?? "Last 7 Days");
        const startDate = (dr as { start_date?: string; start?: string }).start_date ?? (dr as { start: string }).start;
        const endDate = (dr as { end_date?: string; end?: string }).end_date ?? (dr as { end: string }).end;

        // Build SELECT
        const selectFields: string[] = [];
        if (lvl !== "account") {
          selectFields.push("campaign.id", "campaign.name");
        }
        if (lvl === "ad_group" || lvl === "asset") {
          selectFields.push("ad_group.id", "ad_group.name");
        }
        if (lvl === "asset") {
          selectFields.push(
            "asset.id", "asset.name", "asset.type",
            "ad_group_ad_asset_view.field_type",
            "ad_group_ad_asset_view.performance_label"
          );
        }

        // Breakdown segment
        if (breakdown === "network") selectFields.push("segments.ad_network_type");
        if (breakdown === "device") selectFields.push("segments.device");

        // Time granularity
        if (ti === "daily" || ti === "weekly" || ti === "monthly") {
          selectFields.push("segments.date");
        }

        // Metrics
        selectFields.push(
          "metrics.impressions",
          "metrics.clicks",
          "metrics.ctr",
          "metrics.cost_micros",
          "metrics.conversions",
          "metrics.conversions_value",
          "metrics.all_conversions",
          "metrics.video_views",
          "metrics.interactions",
          "metrics.average_cpm",
          "metrics.average_cpc",
          "metrics.biddable_app_install_conversions",
          "metrics.biddable_app_post_install_conversions"
        );

        // FROM clause
        let fromClause: string;
        if (lvl === "asset") fromClause = "ad_group_ad_asset_view";
        else if (lvl === "ad_group") fromClause = "ad_group";
        else fromClause = "campaign"; // campaign & account both use campaign

        // WHERE
        const conditions: string[] = [
          "campaign.advertising_channel_sub_type IN ('APP_CAMPAIGN', 'APP_CAMPAIGN_FOR_ENGAGEMENT')",
          "campaign.status = 'ENABLED'",
          `segments.date BETWEEN '${startDate}' AND '${endDate}'`,
        ];
        if (campaign_id) conditions.push(`campaign.id = ${campaign_id}`);
        if (ad_group_id) conditions.push(`ad_group.id = ${ad_group_id}`);

        const orderBy = `ORDER BY ${sortKeyForEnum(sortField)} DESC`;

        const query = `
          SELECT ${selectFields.join(", ")}
          FROM ${fromClause}
          WHERE ${conditions.join("\n  AND ")}
          ${orderBy}
          LIMIT ${rowLimit}
        `;

        const chunks = await googleAdsQuery(customer_id, query);
        const rows: GoogleAdsRow[] = chunks.flatMap((c) => c.results ?? []);

        if (rows.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: "No data found for the specified filters and date range.",
            }],
          };
        }

        // Aggregate rows
        const aggMap = new Map<string, AggRow>();
        for (const row of rows) {
          const key = lvl === "account"
            ? (breakdown ? getBreakdownValue(row, breakdown) ?? "all" : "all") +
              (row.segments?.date ? `|${row.segments.date}` : "")
            : buildAggKey(row, lvl, breakdown) +
              (row.segments?.date && ti !== "summary" ? `|${row.segments.date}` : "");

          if (!aggMap.has(key)) {
            aggMap.set(key, {
              label: getLabel(row, lvl),
              breakdown: getBreakdownValue(row, breakdown),
              date: row.segments?.date,
              impressions: 0, clicks: 0, costMicros: 0,
              conversions: 0, conversionsValue: 0,
              installs: 0, postInstalls: 0, videoViews: 0,
              averageCpmMicros: 0, averageCpcMicros: 0,
              rowCount: 0,
            });
          }

          const agg = aggMap.get(key)!;
          const m = row.metrics;
          agg.impressions += parseNum(m?.impressions);
          agg.clicks += parseNum(m?.clicks);
          agg.costMicros += parseNum(m?.costMicros);
          agg.conversions += parseNum(m?.conversions);
          agg.conversionsValue += parseNum(m?.conversionsValue);
          agg.installs += parseNum(m?.biddableAppInstallConversions);
          agg.postInstalls += parseNum(m?.biddableAppPostInstallConversions);
          agg.videoViews += parseNum(m?.videoViews);
          agg.averageCpmMicros += parseNum(m?.averageCpm);
          agg.averageCpcMicros += parseNum(m?.averageCpc);
          agg.rowCount += 1;
        }

        const aggRows = Array.from(aggMap.values());

        // Format output
        const levelLabel = lvl.charAt(0).toUpperCase() + lvl.slice(1);
        const breakdownLabel = breakdown ? ` — By ${breakdown.charAt(0).toUpperCase() + breakdown.slice(1)}` : "";
        let text = `## Google Ads Performance — ${dateLabel}${breakdownLabel} (${aggRows.length} ${levelLabel}s)\n\n`;

        // Build header based on what's shown
        const cols: string[] = [];
        if (ti === "daily") cols.push("Date");
        cols.push(levelLabel);
        if (breakdown) cols.push(breakdown.charAt(0).toUpperCase() + breakdown.slice(1));
        cols.push("Spend", "Impr", "Clicks", "CTR", "CPM", "CPC", "Installs", "CPI", "Post-Install", "CPA", "ROAS");

        text += `| ${cols.join(" | ")} |\n`;
        text += `|${cols.map(() => "---").join("|")}|\n`;

        for (const agg of aggRows) {
          const spend = agg.costMicros / 1_000_000;
          const ctr = agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0;
          const cpm = agg.rowCount > 0 ? agg.averageCpmMicros / agg.rowCount / 1_000_000 : 0;
          const cpc = agg.rowCount > 0 ? agg.averageCpcMicros / agg.rowCount / 1_000_000 : 0;
          const cpi = agg.installs > 0 ? spend / agg.installs : 0;
          const cpa = agg.postInstalls > 0 ? spend / agg.postInstalls : 0;
          const roas = spend > 0 ? (agg.conversionsValue / spend) * 100 : 0;

          const vals: string[] = [];
          if (ti === "daily") vals.push(agg.date ?? "—");
          vals.push(agg.label);
          if (breakdown) vals.push(agg.breakdown ?? "—");
          vals.push(
            `$${spend.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
            formatCompact(agg.impressions),
            formatCompact(agg.clicks),
            formatPct(ctr),
            `$${cpm.toFixed(2)}`,
            `$${cpc.toFixed(2)}`,
            agg.installs > 0 ? formatCompact(agg.installs) : "—",
            cpi > 0 ? `$${cpi.toFixed(2)}` : "—",
            agg.postInstalls > 0 ? formatCompact(agg.postInstalls) : "—",
            cpa > 0 ? `$${cpa.toFixed(2)}` : "—",
            roas > 0 ? formatPct(roas) : "—",
          );

          text += `| ${vals.join(" | ")} |\n`;
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
