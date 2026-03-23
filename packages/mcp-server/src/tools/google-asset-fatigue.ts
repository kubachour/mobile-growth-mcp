import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { googleAdsQuery } from "../google/client.js";
import type { GoogleAdsRow } from "../google/types.js";

type FatigueStatus = "FATIGUED" | "WARNING" | "NEEDS_REFRESH" | "LEARNING" | "HEALTHY";

interface DailyMetric {
  date: string;
  impressions: number;
  clicks: number;
  costMicros: number;
  installs: number;
}

interface AssetAnalysis {
  assetId: string;
  assetName: string;
  assetType: string;
  fieldType: string;
  performanceLabel: string;
  status: FatigueStatus;
  ageDays: number;
  impressionDecayPct: number;
  ctrDeclinePct: number;
  cpaChangePct: number;
  action: string;
}

function parseNum(v: string | number | undefined): number {
  if (v === undefined || v === null) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function rolling3DayAvg(values: number[]): number {
  if (values.length === 0) return 0;
  if (values.length <= 3) return values.reduce((a, b) => a + b, 0) / values.length;
  // Return the max/min of 3-day rolling windows
  let best = 0;
  for (let i = 0; i <= values.length - 3; i++) {
    const avg = (values[i] + values[i + 1] + values[i + 2]) / 3;
    if (avg > best) best = avg;
  }
  return best;
}

function rolling3DayMin(values: number[]): number {
  if (values.length === 0) return 0;
  if (values.length <= 3) return values.reduce((a, b) => a + b, 0) / values.length;
  let best = Infinity;
  for (let i = 0; i <= values.length - 3; i++) {
    const avg = (values[i] + values[i + 1] + values[i + 2]) / 3;
    if (avg < best) best = avg;
  }
  return best;
}

function last3Avg(values: number[]): number {
  if (values.length === 0) return 0;
  const slice = values.slice(-3);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function dateFmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function registerGetGoogleAdsAssetFatigue(server: McpServer): void {
  server.tool(
    "get_google_asset_fatigue",
    "Detect creative asset fatigue in Google UAC campaigns by analyzing per-asset impression trends, CTR decline, and CPA deterioration. Also checks asset age against Google's 2-week learning minimum and 2-3 month refresh cadence. Google doesn't expose per-asset frequency — uses impression volume decay as the primary fatigue signal. Never remove assets within first 2 weeks (goog-pdf-018). Google's performance label measures scalability, not fatigue (ab-pt-008).",
    {
      customer_id: z
        .string()
        .describe("Google Ads customer ID"),
      campaign_id: z
        .string()
        .describe("Campaign to analyze"),
      ad_group_id: z
        .string()
        .optional()
        .describe("Scope to specific ad group"),
      lookback_days: z
        .number()
        .min(7)
        .max(90)
        .optional()
        .describe("Days of daily data to analyze (default 14)"),
      ctr_decline_threshold_pct: z
        .number()
        .optional()
        .describe("CTR decline % from peak to flag fatigue (default 30)"),
      impression_decay_threshold_pct: z
        .number()
        .optional()
        .describe("Impression volume drop % from peak to flag (default 50)"),
      asset_type: z
        .array(z.enum(["IMAGE", "YOUTUBE_VIDEO", "TEXT"]))
        .optional()
        .describe("Filter by asset type"),
    },
    async ({ customer_id, campaign_id, ad_group_id, lookback_days, ctr_decline_threshold_pct, impression_decay_threshold_pct, asset_type }) => {
      try {
        const lookback = lookback_days ?? 14;
        const ctrThreshold = ctr_decline_threshold_pct ?? 30;
        const imprThreshold = impression_decay_threshold_pct ?? 50;

        const endDate = new Date();
        endDate.setDate(endDate.getDate() - 1);
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - lookback + 1);

        // Also fetch a wider window for age estimation
        const ageStartDate = new Date(endDate);
        ageStartDate.setDate(ageStartDate.getDate() - 89); // max 90 days back

        const conditions: string[] = [
          `campaign.id = ${campaign_id}`,
          `segments.date BETWEEN '${dateFmt(startDate)}' AND '${dateFmt(endDate)}'`,
        ];
        if (ad_group_id) conditions.push(`ad_group.id = ${ad_group_id}`);
        if (asset_type?.length) {
          const typeList = asset_type.map((t) => `'${t}'`).join(", ");
          conditions.push(`asset.type IN (${typeList})`);
        }

        const query = `
          SELECT
            asset.id,
            asset.name,
            asset.type,
            ad_group_ad_asset_view.field_type,
            ad_group_ad_asset_view.performance_label,
            ad_group.id,
            ad_group.name,
            segments.date,
            metrics.impressions,
            metrics.clicks,
            metrics.cost_micros,
            metrics.conversions,
            metrics.biddable_app_install_conversions
          FROM ad_group_ad_asset_view
          WHERE ${conditions.join("\n  AND ")}
          ORDER BY segments.date ASC
        `;

        const chunks = await googleAdsQuery(customer_id, query);
        const rows: GoogleAdsRow[] = chunks.flatMap((c) => c.results ?? []);

        if (rows.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: "No asset performance data found for the specified campaign and date range.",
            }],
          };
        }

        // Group by asset
        const assetDaily = new Map<string, {
          name: string;
          type: string;
          fieldType: string;
          performanceLabel: string;
          days: Map<string, DailyMetric>;
        }>();

        for (const row of rows) {
          const assetId = row.asset?.id ?? "?";
          if (!assetDaily.has(assetId)) {
            assetDaily.set(assetId, {
              name: row.asset?.name ?? "—",
              type: row.asset?.type ?? "—",
              fieldType: row.adGroupAdAssetView?.fieldType ?? "—",
              performanceLabel: row.adGroupAdAssetView?.performanceLabel ?? "—",
              days: new Map(),
            });
          }
          const entry = assetDaily.get(assetId)!;
          const date = row.segments?.date ?? "unknown";
          if (!entry.days.has(date)) {
            entry.days.set(date, { date, impressions: 0, clicks: 0, costMicros: 0, installs: 0 });
          }
          const dm = entry.days.get(date)!;
          dm.impressions += parseNum(row.metrics?.impressions);
          dm.clicks += parseNum(row.metrics?.clicks);
          dm.costMicros += parseNum(row.metrics?.costMicros);
          dm.installs += parseNum(row.metrics?.biddableAppInstallConversions);
        }

        // Analyze each asset
        const analyses: AssetAnalysis[] = [];

        for (const [assetId, data] of assetDaily) {
          const sortedDays = [...data.days.values()].sort((a, b) => a.date.localeCompare(b.date));
          const daysWithImpressions = sortedDays.filter((d) => d.impressions > 0);

          // Skip assets with insufficient data
          if (daysWithImpressions.length < 3) continue;

          // Estimate asset age from earliest impression date
          const firstDate = new Date(daysWithImpressions[0].date);
          const ageDays = Math.floor((endDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

          // Impression analysis
          const dailyImpr = sortedDays.map((d) => d.impressions);
          const peakImpr = rolling3DayAvg(dailyImpr);
          const recentImpr = last3Avg(dailyImpr);
          const imprDecay = peakImpr > 0 ? ((peakImpr - recentImpr) / peakImpr) * 100 : 0;

          // CTR analysis
          const dailyCtr = sortedDays.map((d) => d.impressions > 0 ? d.clicks / d.impressions : 0);
          const peakCtr = rolling3DayAvg(dailyCtr);
          const recentCtr = last3Avg(dailyCtr);
          const ctrDecline = peakCtr > 0 ? ((peakCtr - recentCtr) / peakCtr) * 100 : 0;

          // CPA analysis
          const dailyCpa = sortedDays.map((d) => d.installs > 0 ? d.costMicros / d.installs / 1_000_000 : 0);
          const nonZeroCpa = dailyCpa.filter((c) => c > 0);
          const peakCpa = nonZeroCpa.length >= 3 ? rolling3DayMin(nonZeroCpa) : (nonZeroCpa.length > 0 ? Math.min(...nonZeroCpa) : 0);
          const recentCpa = last3Avg(dailyCpa.filter((c) => c > 0).length >= 3 ? dailyCpa.slice(-3) : dailyCpa);
          const cpaChange = peakCpa > 0 ? ((recentCpa - peakCpa) / peakCpa) * 100 : 0;

          // Determine status
          let status: FatigueStatus;
          let action: string;

          if (ageDays < 14) {
            status = "LEARNING";
            action = `In learning phase — evaluate after day 14`;
          } else if (imprDecay > imprThreshold && (ctrDecline > ctrThreshold || cpaChange > 50)) {
            status = "FATIGUED";
            if (ageDays > 75) {
              action = "Replace — past refresh window, declining on all signals";
            } else {
              action = "Replace — impression decay + " + (ctrDecline > ctrThreshold ? "CTR decline" : "CPA deterioration");
            }
          } else if (ageDays > 75) {
            status = "NEEDS_REFRESH";
            action = "Approaching 75+ day age — evaluate for replacement";
          } else if (imprDecay > imprThreshold || ctrDecline > ctrThreshold || cpaChange > 30) {
            status = "WARNING";
            const signals = [];
            if (imprDecay > imprThreshold) signals.push("impression decay");
            if (ctrDecline > ctrThreshold) signals.push("CTR decline");
            if (cpaChange > 30) signals.push("CPA increase");
            action = `${signals.join(" + ")} beginning — watch next 7 days`;
          } else {
            status = "HEALTHY";
            action = "Stable performance";
          }

          analyses.push({
            assetId,
            assetName: data.name,
            assetType: data.type,
            fieldType: data.fieldType,
            performanceLabel: data.performanceLabel,
            status,
            ageDays,
            impressionDecayPct: imprDecay,
            ctrDeclinePct: ctrDecline,
            cpaChangePct: cpaChange,
            action,
          });
        }

        // Sort by priority
        const priority: Record<FatigueStatus, number> = {
          FATIGUED: 0, NEEDS_REFRESH: 1, WARNING: 2, LEARNING: 3, HEALTHY: 4,
        };
        analyses.sort((a, b) => priority[a.status] - priority[b.status]);

        // Group by status
        const fatigued = analyses.filter((a) => a.status === "FATIGUED");
        const needsRefresh = analyses.filter((a) => a.status === "NEEDS_REFRESH");
        const warning = analyses.filter((a) => a.status === "WARNING");
        const learning = analyses.filter((a) => a.status === "LEARNING");
        const healthy = analyses.filter((a) => a.status === "HEALTHY");

        const campaignName = rows[0]?.campaign?.name ?? campaign_id;

        let text = `## Asset Fatigue Analysis — ${campaignName} — Last ${lookback} Days\n\n`;
        text += `### Summary\n`;
        text += `- Total assets analyzed: ${analyses.length}\n`;
        if (fatigued.length > 0) text += `- 🔴 FATIGUED: ${fatigued.length} (replace these first)\n`;
        if (warning.length > 0) text += `- 🟡 WARNING: ${warning.length} (monitor closely)\n`;
        if (healthy.length > 0) text += `- 🟢 HEALTHY: ${healthy.length}\n`;
        if (learning.length > 0) text += `- 📘 LEARNING: ${learning.length} (do not remove — need more time)\n`;
        if (needsRefresh.length > 0) text += `- 🔄 NEEDS_REFRESH: ${needsRefresh.length} (approaching 75+ day age)\n`;
        text += "\n";

        // Fatigued table
        if (fatigued.length > 0) {
          text += "### Fatigued Assets (Action Required)\n";
          text += "| Asset | Type | Field | Label | Impr Decay | CTR Decline | CPA Change | Age | Action |\n";
          text += "|---|---|---|---|---|---|---|---|---|\n";
          for (const a of fatigued) {
            text += `| ${a.assetName} | ${a.assetType} | ${a.fieldType} | ${a.performanceLabel} | -${a.impressionDecayPct.toFixed(0)}% | -${a.ctrDeclinePct.toFixed(0)}% | +${a.cpaChangePct.toFixed(0)}% | ${a.ageDays} days | ${a.action} |\n`;
          }
          text += "\n";
        }

        // Needs refresh table
        if (needsRefresh.length > 0) {
          text += "### Assets Needing Refresh (75+ days)\n";
          text += "| Asset | Type | Field | Label | Age | Action |\n";
          text += "|---|---|---|---|---|---|\n";
          for (const a of needsRefresh) {
            text += `| ${a.assetName} | ${a.assetType} | ${a.fieldType} | ${a.performanceLabel} | ${a.ageDays} days | ${a.action} |\n`;
          }
          text += "\n";
        }

        // Warning table
        if (warning.length > 0) {
          text += "### Warning Assets (Monitor)\n";
          text += "| Asset | Type | Field | Label | Impr Decay | CTR Decline | CPA Change | Age | Note |\n";
          text += "|---|---|---|---|---|---|---|---|---|\n";
          for (const a of warning) {
            text += `| ${a.assetName} | ${a.assetType} | ${a.fieldType} | ${a.performanceLabel} | -${a.impressionDecayPct.toFixed(0)}% | -${a.ctrDeclinePct.toFixed(0)}% | +${a.cpaChangePct.toFixed(0)}% | ${a.ageDays} days | ${a.action} |\n`;
          }
          text += "\n";
        }

        // Learning table
        if (learning.length > 0) {
          text += "### Learning Assets (Do Not Remove)\n";
          text += "| Asset | Type | Field | Age | Note |\n";
          text += "|---|---|---|---|---|\n";
          for (const a of learning) {
            text += `| ${a.assetName} | ${a.assetType} | ${a.fieldType} | ${a.ageDays} days | ${a.action} |\n`;
          }
          text += "\n";
        }

        // Recommendations
        text += "### Recommendations\n";
        text += "Based on the analysis and Mobile Growth knowledge base:\n\n";
        if (fatigued.length > 0) {
          const pastRefresh = fatigued.filter((a) => a.ageDays > 75).length;
          text += `1. **Replace ${fatigued.length} fatigued assets**`;
          if (pastRefresh > 0) text += ` — prioritize the ${pastRefresh} past the 75-day refresh window`;
          text += "\n";
        }
        if (learning.length > 0) {
          text += `2. **Do NOT remove the ${learning.length} learning assets** — they need at least 14 days before evaluation (goog-pdf-018)\n`;
        }
        text += `3. **Replace 2-3 assets at a time**, not all at once — maintain algorithmic stability (goog-pdf-018)\n`;
        text += `4. **Add variants inspired by your "Best" rated assets** when replacing (goog-pdf-018)\n`;

        const mislabeled = fatigued.filter((a) => a.performanceLabel === "GOOD" || a.performanceLabel === "BEST");
        if (mislabeled.length > 0) {
          const names = mislabeled.map((a) => `"${a.assetName}"`).join(", ");
          text += `5. Note: ${names} rated "${mislabeled[0].performanceLabel}" by Google but fatigued by actual CTR/CPA metrics — Google's label measures scalability, not value (ab-pt-008)\n`;
        }

        text += `\nSources: goog-pdf-018, ab-pt-008, goog-pdf-019, ab-pt-007\n`;

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
