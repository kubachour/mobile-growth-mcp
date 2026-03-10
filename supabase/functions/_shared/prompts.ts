// Prompt manifest — metadata for each MCP prompt served by the Edge Function.
// Mirrors the pattern in tools.ts but for prompts.

export interface PromptArgDef {
  name: string;
  description: string;
  required: boolean;
}

export interface PromptDef {
  name: string;
  description: string;
  arguments: PromptArgDef[];
}

const AD_ACCOUNT_ARG: PromptArgDef = {
  name: "ad_account_id",
  description: "Meta ad account ID (e.g. act_123456789)",
  required: true,
};

export const prompts: PromptDef[] = [
  {
    name: "ad-fatigue-report",
    description:
      "Detect creative fatigue — analyzes frequency, CTR decline, and CPA trends to flag exhausted creatives.",
    arguments: [AD_ACCOUNT_ARG],
  },
  {
    name: "weekly-performance",
    description:
      "Monday morning check — week-over-week health comparison with automatic diagnosis per Kast framework.",
    arguments: [AD_ACCOUNT_ARG],
  },
  {
    name: "creative-performance",
    description:
      "Categorize every active ad by health status (scaling, promising, contributing, fatiguing, dead weight).",
    arguments: [AD_ACCOUNT_ARG],
  },
  {
    name: "audience-composition",
    description:
      "Age × gender heatmap showing who converts and at what cost, with demographic optimization recommendations.",
    arguments: [AD_ACCOUNT_ARG],
  },
  {
    name: "architecture-review",
    description:
      "Evaluate campaign structure for scale — checks consolidation, creative counts, campaign types, bid strategies.",
    arguments: [AD_ACCOUNT_ARG],
  },
  {
    name: "audit-meta-account",
    description:
      "Comprehensive Meta ad account audit against knowledge base best practices. Covers structure, creative, audience, bids, signals, and funnel.",
    arguments: [AD_ACCOUNT_ARG],
  },
  {
    name: "campaign-comparison",
    description:
      "Compare two campaigns side-by-side to identify why one outperforms the other.",
    arguments: [
      AD_ACCOUNT_ARG,
      {
        name: "campaign_id_a",
        description: "First campaign ID to compare",
        required: false,
      },
      {
        name: "campaign_id_b",
        description: "Second campaign ID to compare",
        required: false,
      },
    ],
  },
  {
    name: "placement-audit",
    description:
      "Detailed placement efficiency audit with waste quantification and restriction recommendations.",
    arguments: [AD_ACCOUNT_ARG],
  },
  {
    name: "attribution-analysis",
    description:
      "Validate conversion quality using attribution windows, view-through ratios, and daily consistency checks.",
    arguments: [AD_ACCOUNT_ARG],
  },
];
