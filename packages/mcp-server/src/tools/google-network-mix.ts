import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { googleAdsQuery } from "../google/client.js";
import { datePresetToRange } from "../google/format.js";
import type { GoogleAdsRow } from "../google/types.js";

interface DayNetwork {
  date: string;
  network: string;
  costMicros: number;
  impressions: number;
  clicks: number;
  installs: number;
}

function parseNum(v: string | number | undefined): number {
  if (v === undefined || v === null) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

export function registerGetGoogleAdsNetworkMix(server: McpServer): void {
  server.tool(
    "get_google_network_mix",
    "Analyze traffic distribution across Google's ad networks (Search, Display/AdMob, YouTube) over time. Computes spend share % per network per day and flags significant shifts. Traffic shifts signal performance problems — a sudden shift to Display/MGDN tanks CPA. Google optimizes for Google's revenue alongside yours; use this to detect shifts to low-quality inventory (ab-pt-005, ab-pt-017).",
    {
      customer_id: z
        .string()
        .describe("Google Ads customer ID"),
      campaign_id: z
        .string()
        .optional()
        .describe("Scope to one campaign. If omitted, aggregates across all app campaigns"),
      date_range: z
        .object({
          start_date: z.string().describe("YYYY-MM-DD"),
          end_date: z.string().describe("YYYY-MM-DD"),
        })
        .optional()
        .describe("Custom date range. Default: last 14 days"),
      shift_threshold_pct: z
        .number()
        .optional()
        .describe("Flag networks whose spend share changed by more than this % (default 10)"),
    },
    async ({ customer_id, campaign_id, date_range, shift_threshold_pct }) => {
      try {
        const threshold = shift_threshold_pct ?? 10;
        const dr = date_range ?? datePresetToRange("LAST_14_DAYS");
        const startDate = (dr as { start_date?: string; start?: string }).start_date ?? (dr as { start: string }).start;
        const endDate = (dr as { end_date?: string; end?: string }).end_date ?? (dr as { end: string }).end;

        const conditions: string[] = [
          "campaign.advertising_channel_sub_type IN ('APP_CAMPAIGN', 'APP_CAMPAIGN_FOR_ENGAGEMENT')",
          "campaign.status = 'ENABLED'",
          `segments.date BETWEEN '${startDate}' AND '${endDate}'`,
        ];
        if (campaign_id) conditions.push(`campaign.id = ${campaign_id}`);

        const query = `
          SELECT
            campaign.id,
            campaign.name,
            segments.ad_network_type,
            segments.date,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.conversions_value,
            metrics.average_cpm,
            metrics.biddable_app_install_conversions,
            metrics.biddable_app_post_install_conversions
          FROM campaign
          WHERE ${conditions.join("\n  AND ")}
          ORDER BY segments.date ASC
        `;

        const chunks = await googleAdsQuery(customer_id, query);
        const rows: GoogleAdsRow[] = chunks.flatMap((c) => c.results ?? []);

        if (rows.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: "No network data found for the specified filters and date range.",
            }],
          };
        }

        // Aggregate by date + network
        const dayNetMap = new Map<string, DayNetwork>();
        for (const row of rows) {
          const date = row.segments?.date ?? "unknown";
          const network = row.segments?.adNetworkType ?? "UNKNOWN";
          const key = `${date}|${network}`;

          if (!dayNetMap.has(key)) {
            dayNetMap.set(key, { date, network, costMicros: 0, impressions: 0, clicks: 0, installs: 0 });
          }
          const dn = dayNetMap.get(key)!;
          dn.costMicros += parseNum(row.metrics?.costMicros);
          dn.impressions += parseNum(row.metrics?.impressions);
          dn.clicks += parseNum(row.metrics?.clicks);
          dn.installs += parseNum(row.metrics?.biddableAppInstallConversions);
        }

        const dayNets = Array.from(dayNetMap.values());

        // Get unique dates and networks
        const dates = [...new Set(dayNets.map((d) => d.date))].sort();
        const networks = [...new Set(dayNets.map((d) => d.network))].sort();

        // Compute daily totals
        const dailyTotals = new Map<string, number>();
        for (const dn of dayNets) {
          dailyTotals.set(dn.date, (dailyTotals.get(dn.date) ?? 0) + dn.costMicros);
        }

        // Build daily distribution table
        const campaignLabel = campaign_id && rows[0]?.campaign?.name
          ? ` — ${rows[0].campaign.name}`
          : "";
        let text = `## Network Mix${campaignLabel} — ${startDate} to ${endDate}\n\n`;

        // Header
        const headerCols = ["Date"];
        for (const net of networks) {
          headerCols.push(net, `${net} %`);
        }
        headerCols.push("Total");
        text += `| ${headerCols.join(" | ")} |\n`;
        text += `|${headerCols.map(() => "---").join("|")}|\n`;

        // Daily rows
        const networkDatePct = new Map<string, Map<string, number>>(); // network -> date -> pct
        for (const net of networks) {
          networkDatePct.set(net, new Map());
        }

        for (const date of dates) {
          const total = dailyTotals.get(date) ?? 1;
          const vals: string[] = [date];
          for (const net of networks) {
            const dn = dayNets.find((d) => d.date === date && d.network === net);
            const cost = dn?.costMicros ?? 0;
            const pct = total > 0 ? (cost / total) * 100 : 0;
            networkDatePct.get(net)!.set(date, pct);
            vals.push(
              `$${(cost / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
              `${pct.toFixed(0)}%`
            );
          }
          vals.push(`$${(total / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`);
          text += `| ${vals.join(" | ")} |\n`;
        }

        // Shift analysis
        const midIdx = Math.floor(dates.length / 2);
        const firstHalfDates = dates.slice(0, midIdx);
        const secondHalfDates = dates.slice(midIdx);

        text += `\n### Network Shift Analysis (first ${firstHalfDates.length} days vs. last ${secondHalfDates.length} days)\n\n`;
        text += "| Network | First Half | Second Half | Shift | Status |\n|---|---|---|---|---|\n";

        const flagged: Array<{ network: string; shift: number; direction: string }> = [];

        for (const net of networks) {
          const pctMap = networkDatePct.get(net)!;
          const firstAvg = firstHalfDates.length > 0
            ? firstHalfDates.reduce((s, d) => s + (pctMap.get(d) ?? 0), 0) / firstHalfDates.length
            : 0;
          const secondAvg = secondHalfDates.length > 0
            ? secondHalfDates.reduce((s, d) => s + (pctMap.get(d) ?? 0), 0) / secondHalfDates.length
            : 0;
          const shift = secondAvg - firstAvg;
          const isFlagged = Math.abs(shift) > threshold;

          if (isFlagged) {
            flagged.push({
              network: net,
              shift,
              direction: shift > 0 ? "increasing" : "declining",
            });
          }

          text += `| ${net} | ${firstAvg.toFixed(0)}% | ${secondAvg.toFixed(0)}% | ${shift > 0 ? "+" : ""}${shift.toFixed(0)}% | ${isFlagged ? `⚠️ FLAGGED — ${net} share ${shift > 0 ? "increasing" : "declining"}` : "✅ Stable"} |\n`;
        }

        // Interpretation guidance
        if (flagged.length > 0) {
          const increasing = flagged.filter((f) => f.shift > 0);
          const declining = flagged.filter((f) => f.shift < 0);

          text += "\n";
          const parts: string[] = [];
          for (const f of increasing) {
            parts.push(`${f.network} spend share increased by ${Math.abs(f.shift).toFixed(0)}%`);
          }
          for (const f of declining) {
            parts.push(`${f.network} decreased by ${Math.abs(f.shift).toFixed(0)}%`);
          }
          text += `⚠️ Significant network shift detected: ${parts.join(" while ")}.\n`;

          const hasDisplayIncrease = increasing.some((f) =>
            f.network.includes("DISPLAY") || f.network.includes("CONTENT")
          );
          if (hasDisplayIncrease) {
            text += "This may indicate the algorithm is shifting to lower-quality Display/MGDN inventory.\n";
          }

          text += "\nRecommended actions:\n";
          text += "- Check the placement report for underperforming apps/sites\n";
          text += "- Cross-reference with MMP data to verify conversion quality per network\n";
          text += "- If CPA has risen, the network shift is likely the cause\n";
          text += "\nSources: ab-pt-005, ab-pt-017, gg135-005\n";
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
