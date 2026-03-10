import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  AD_FATIGUE_PROMPT,
  WEEKLY_PERFORMANCE_PROMPT,
  CREATIVE_PERFORMANCE_PROMPT,
  PLACEMENT_EFFICIENCY_PROMPT,
  AUDIENCE_COMPOSITION_PROMPT,
  ARCHITECTURE_REVIEW_PROMPT,
  AUDIT_META_ACCOUNT_PROMPT,
  CAMPAIGN_COMPARISON_PROMPT,
  PLACEMENT_AUDIT_PROMPT,
  ATTRIBUTION_ANALYSIS_PROMPT,
} from "./skill-content.js";

interface PromptDef {
  name: string;
  description: string;
  content: string;
  needsCampaignId?: boolean;
}

const PROMPTS: PromptDef[] = [
  {
    name: "ad-fatigue-report",
    description:
      "Detect creative fatigue — analyzes frequency, CTR decline, and CPA trends to flag exhausted creatives.",
    content: AD_FATIGUE_PROMPT,
  },
  {
    name: "weekly-performance",
    description:
      "Monday morning check — week-over-week health comparison with automatic diagnosis per Kast framework.",
    content: WEEKLY_PERFORMANCE_PROMPT,
  },
  {
    name: "creative-performance",
    description:
      "Categorize every active ad by health status (scaling, promising, contributing, fatiguing, dead weight).",
    content: CREATIVE_PERFORMANCE_PROMPT,
  },
  {
    name: "placement-efficiency",
    description:
      "Identify placement waste and quantify potential CPI savings from removing junk placements.",
    content: PLACEMENT_EFFICIENCY_PROMPT,
  },
  {
    name: "audience-composition",
    description:
      "Age × gender heatmap showing who converts and at what cost, with demographic optimization recommendations.",
    content: AUDIENCE_COMPOSITION_PROMPT,
  },
  {
    name: "architecture-review",
    description:
      "Evaluate campaign structure for scale — checks consolidation, creative counts, campaign types, bid strategies.",
    content: ARCHITECTURE_REVIEW_PROMPT,
  },
  {
    name: "audit-meta-account",
    description:
      "Comprehensive Meta ad account audit against knowledge base best practices. Covers structure, creative, audience, bids, signals, and funnel.",
    content: AUDIT_META_ACCOUNT_PROMPT,
  },
  {
    name: "campaign-comparison",
    description:
      "Compare two campaigns side-by-side to identify why one outperforms the other.",
    content: CAMPAIGN_COMPARISON_PROMPT,
    needsCampaignId: true,
  },
  {
    name: "placement-audit",
    description:
      "Detailed placement efficiency audit with waste quantification and restriction recommendations.",
    content: PLACEMENT_AUDIT_PROMPT,
  },
  {
    name: "attribution-analysis",
    description:
      "Validate conversion quality using attribution windows, view-through ratios, and daily consistency checks.",
    content: ATTRIBUTION_ANALYSIS_PROMPT,
  },
];

export function registerPrompts(server: McpServer): void {
  for (const prompt of PROMPTS) {
    if (prompt.needsCampaignId) {
      server.prompt(
        prompt.name,
        prompt.description,
        {
          ad_account_id: z
            .string()
            .describe("Meta ad account ID (e.g. act_123456789)"),
          campaign_id_a: z
            .string()
            .optional()
            .describe("First campaign ID to compare"),
          campaign_id_b: z
            .string()
            .optional()
            .describe("Second campaign ID to compare"),
        },
        ({ ad_account_id, campaign_id_a, campaign_id_b }) => ({
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text:
                  `Ad account: ${ad_account_id}` +
                  (campaign_id_a
                    ? `\nCampaign A: ${campaign_id_a}`
                    : "") +
                  (campaign_id_b
                    ? `\nCampaign B: ${campaign_id_b}`
                    : "") +
                  `\n\n${prompt.content}`,
              },
            },
          ],
        })
      );
    } else {
      server.prompt(
        prompt.name,
        prompt.description,
        {
          ad_account_id: z
            .string()
            .describe("Meta ad account ID (e.g. act_123456789)"),
        },
        ({ ad_account_id }) => ({
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text: `Ad account: ${ad_account_id}\n\n${prompt.content}`,
              },
            },
          ],
        })
      );
    }
  }
}
