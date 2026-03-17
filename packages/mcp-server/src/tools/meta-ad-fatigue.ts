import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  metaApiGet,
  activeFilter,
  getActionValue,
  getCostPerAction,
} from "../meta/client.js";
import type { MetaListResponse, MetaInsightRow } from "../meta/types.js";

interface AdDailyData {
  ad_id: string;
  ad_name: string;
  days: {
    date: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpm: number;
    frequency: number;
    conversions: number;
    cpa: number | null;
  }[];
}

interface FatigueResult {
  ad_id: string;
  ad_name: string;
  total_spend: number;
  avg_frequency: number;
  peak_ctr: number;
  recent_ctr: number;
  ctr_decline_pct: number;
  early_cpa: number | null;
  recent_cpa: number | null;
  cpa_change_pct: number | null;
  status: "FATIGUED" | "WARNING" | "HEALTHY";
  diagnosis: string;
}

export function registerGetMetaAdFatigue(server: McpServer): void {
  server.tool(
    "get_meta_ad_fatigue",
    "Detect creative fatigue in active ads. Analyzes frequency, CTR decline, and CPA trends over the last 7 days at daily granularity. Grounded in knowledge base insights: wk-tw-001 (diagnostic patterns), ds-pt-003 (frequency thresholds), vs-nt-002 (degraded creative rules).",
    {
      ad_account_id: z
        .string()
        .describe("Meta ad account ID (e.g. act_123456789)"),
      campaign_id: z
        .string()
        .optional()
        .describe("Scope to a specific campaign"),
      conversion_event: z
        .string()
        .optional()
        .describe("Action type for CPA (default: mobile_app_install)"),
      frequency_warning: z
        .number()
        .optional()
        .describe("Frequency threshold for warning (default: 3)"),
      frequency_critical: z
        .number()
        .optional()
        .describe("Frequency threshold for critical (default: 5)"),
      ctr_decline_threshold: z
        .number()
        .optional()
        .describe(
          "CTR decline % from peak to flag fatigue (default: 30)"
        ),
    },
    async ({
      ad_account_id,
      campaign_id,
      conversion_event,
      frequency_warning,
      frequency_critical,
      ctr_decline_threshold,
    }) => {
      try {
        const convEvent = conversion_event ?? "mobile_app_install";
        const freqWarn = frequency_warning ?? 3;
        const freqCrit = frequency_critical ?? 5;
        const ctrThreshold = ctr_decline_threshold ?? 30;

        // Single API call: ad-level, daily granularity, last 7 days
        // Always use account-level endpoint — campaign-scoped endpoint
        // doesn't support effective_status filtering
        const filtering = JSON.parse(activeFilter()) as unknown[];
        if (campaign_id) {
          filtering.push({
            field: "campaign.id",
            operator: "EQUAL",
            value: campaign_id,
          });
        }

        const result = await metaApiGet<MetaListResponse<MetaInsightRow>>({
          path: `/${ad_account_id}/insights`,
          params: {
            level: "ad",
            time_increment: "1",
            fields:
              "ad_id,ad_name,spend,impressions,clicks,ctr,cpm,frequency,actions,cost_per_action_type",
            date_preset: "last_7d",
            filtering: JSON.stringify(filtering),
            limit: "500",
          },
        });

        const rows = result.data.data;
        if (!rows || rows.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No active ad data found for the last 7 days.",
              },
            ],
          };
        }

        // Group by ad_id
        const adMap = new Map<string, AdDailyData>();
        for (const row of rows) {
          const adId = row.ad_id!;
          if (!adMap.has(adId)) {
            adMap.set(adId, {
              ad_id: adId,
              ad_name: row.ad_name ?? adId,
              days: [],
            });
          }
          adMap.get(adId)!.days.push({
            date: row.date_start,
            spend: parseFloat(row.spend || "0"),
            impressions: parseInt(row.impressions || "0"),
            clicks: parseInt(row.clicks || "0"),
            ctr: parseFloat(row.ctr || "0"),
            cpm: parseFloat(row.cpm || "0"),
            frequency: parseFloat(row.frequency || "0"),
            conversions: getActionValue(row.actions, convEvent),
            cpa: getCostPerAction(row.cost_per_action_type, convEvent),
          });
        }

        // Analyze each ad
        const results: FatigueResult[] = [];
        let totalSpend = 0;

        for (const ad of adMap.values()) {
          // Sort days chronologically
          ad.days.sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          );

          const adSpend = ad.days.reduce((s, d) => s + d.spend, 0);
          totalSpend += adSpend;

          // Average frequency across the period
          const avgFreq =
            ad.days.reduce((s, d) => s + d.frequency, 0) / ad.days.length;

          // Peak CTR vs last 3 days average
          const peakCtr = Math.max(...ad.days.map((d) => d.ctr));
          const last3 = ad.days.slice(-3);
          const recentCtr =
            last3.reduce((s, d) => s + d.ctr, 0) / last3.length;
          const ctrDecline =
            peakCtr > 0 ? ((peakCtr - recentCtr) / peakCtr) * 100 : 0;

          // CPA trend: first half vs second half
          const mid = Math.floor(ad.days.length / 2);
          const earlyDays = ad.days.slice(0, Math.max(mid, 1));
          const lateDays = ad.days.slice(mid);

          const earlyConv = earlyDays.reduce((s, d) => s + d.conversions, 0);
          const earlySpend = earlyDays.reduce((s, d) => s + d.spend, 0);
          const earlyCpa = earlyConv > 0 ? earlySpend / earlyConv : null;

          const lateConv = lateDays.reduce((s, d) => s + d.conversions, 0);
          const lateSpend = lateDays.reduce((s, d) => s + d.spend, 0);
          const recentCpa = lateConv > 0 ? lateSpend / lateConv : null;

          const cpaChange =
            earlyCpa !== null && recentCpa !== null && earlyCpa > 0
              ? ((recentCpa - earlyCpa) / earlyCpa) * 100
              : null;

          // Diagnose
          let status: FatigueResult["status"] = "HEALTHY";
          let diagnosis = "Metrics stable — no fatigue detected.";

          const highFreq = avgFreq >= freqCrit;
          const medFreq = avgFreq >= freqWarn;
          const ctrDeclining = ctrDecline >= ctrThreshold;
          const cpaRising = cpaChange !== null && cpaChange > 20;

          if (highFreq && cpaRising) {
            status = "FATIGUED";
            diagnosis = `Audience saturation: frequency ${avgFreq.toFixed(1)} + CPA rising ${cpaChange!.toFixed(0)}% [wk-tw-001 #1, ds-pt-003]`;
          } else if (ctrDeclining && cpaRising) {
            status = "FATIGUED";
            diagnosis = `Creative fatigue: CTR declined ${ctrDecline.toFixed(0)}% from peak + CPA rising ${cpaChange!.toFixed(0)}% [wk-tw-001 #4]`;
          } else if (highFreq) {
            status = "WARNING";
            diagnosis = `High frequency (${avgFreq.toFixed(1)}) — approaching saturation [ds-pt-003]. CPA ${cpaRising ? "rising" : "stable"}.`;
          } else if (ctrDeclining) {
            status = "WARNING";
            diagnosis = `CTR declining ${ctrDecline.toFixed(0)}% from peak — early fatigue signal [wk-tw-001 #4].`;
          } else if (medFreq && cpaRising) {
            status = "WARNING";
            diagnosis = `Frequency ${avgFreq.toFixed(1)} + CPA trending up ${cpaChange!.toFixed(0)}% — monitor closely [wk-tw-001 #1].`;
          }

          results.push({
            ad_id: ad.ad_id,
            ad_name: ad.ad_name,
            total_spend: adSpend,
            avg_frequency: avgFreq,
            peak_ctr: peakCtr,
            recent_ctr: recentCtr,
            ctr_decline_pct: ctrDecline,
            early_cpa: earlyCpa,
            recent_cpa: recentCpa,
            cpa_change_pct: cpaChange,
            status,
            diagnosis,
          });
        }

        // Sort: FATIGUED first, then WARNING, then HEALTHY, then by spend desc
        const statusOrder = { FATIGUED: 0, WARNING: 1, HEALTHY: 2 };
        results.sort(
          (a, b) =>
            statusOrder[a.status] - statusOrder[b.status] ||
            b.total_spend - a.total_spend
        );

        // Summary
        const fatigued = results.filter((r) => r.status === "FATIGUED");
        const warning = results.filter((r) => r.status === "WARNING");
        const healthy = results.filter((r) => r.status === "HEALTHY");
        const fatiguedSpend = fatigued.reduce((s, r) => s + r.total_spend, 0);
        const spendConcentration =
          totalSpend > 0 ? (fatiguedSpend / totalSpend) * 100 : 0;

        let text = `# Ad Fatigue Report\n\n`;
        text += `**${results.length} ads analyzed** | ${fatigued.length} fatigued | ${warning.length} warning | ${healthy.length} healthy\n`;
        text += `**Total spend:** $${totalSpend.toFixed(2)} | **Fatigued ad spend:** $${fatiguedSpend.toFixed(2)} (${spendConcentration.toFixed(0)}%)\n\n`;

        if (spendConcentration > 50) {
          text += `⚠ **Over 50% of spend is going to fatigued ads.** Urgent creative rotation needed.\n\n`;
        }

        // Results table
        text += `| Status | Ad | Spend | Freq | CTR (peak→recent) | CPA Trend | Diagnosis |\n`;
        text += `|--------|-----|-------|------|-------------------|-----------|------------|\n`;

        for (const r of results) {
          const icon =
            r.status === "FATIGUED"
              ? "🔴"
              : r.status === "WARNING"
                ? "🟡"
                : "🟢";
          text +=
            `| ${icon} ${r.status} | ${r.ad_name.slice(0, 30)} | $${r.total_spend.toFixed(0)} | ${r.avg_frequency.toFixed(1)} | ${r.peak_ctr.toFixed(2)}%→${r.recent_ctr.toFixed(2)}% (${r.ctr_decline_pct > 0 ? "-" : ""}${r.ctr_decline_pct.toFixed(0)}%) | ${r.cpa_change_pct !== null ? `${r.cpa_change_pct > 0 ? "+" : ""}${r.cpa_change_pct.toFixed(0)}%` : "N/A"} | ${r.diagnosis} |\n`;
        }

        // Recommendations
        text += `\n## Recommendations\n\n`;

        if (fatigued.length > 0) {
          text +=
            `### Fatigued Ads (${fatigued.length})\n` +
            `- **Rotate with genuinely new creative concepts**, not variations. Meta's Andromeda requires at least 25% visual difference to treat it as a new ad [lp-pt-001, oh-li-001].\n` +
            `- **Change the hook** (first 3 seconds) to access new audience segments [oh-li-005].\n` +
            `- **Do NOT re-test degraded creatives** — exhaust all other angles first. Wait 3-6 months before revisiting [vs-nt-002].\n` +
            `- Meta will auto-shift spend away from degrading creatives [vs-nt-001] — don't panic-pause, but do prepare replacements.\n\n`;
        }

        if (healthy.length > 0) {
          text +=
            `### Healthy Ads (${healthy.length})\n` +
            `- Let Meta manage allocation. Don't force spend to low-spend winners — Meta has determined scaling them would degrade performance [ds-pt-004].\n\n`;
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
