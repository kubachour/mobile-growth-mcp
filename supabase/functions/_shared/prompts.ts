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

const GOOGLE_CUSTOMER_ARG: PromptArgDef = {
  name: "customer_id",
  description: "Google Ads customer ID (e.g. 123-456-7890). Optional — skill also works with CSV export if Google Ads is not connected.",
  required: false,
};

export const prompts: PromptDef[] = [
  {
    name: "admin-briefing",
    description:
      "Morning briefing for admins — checks pending suggestions, recent bugs, knowledge gaps, and top searches.",
    arguments: [],
  },
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

  // Google Ads skills
  {
    name: "google-campaign-health",
    description:
      "Week-over-week Google App Campaign health check — diagnoses CPI trends, flags campaigns below algorithm thresholds, and identifies stalled or degrading campaigns.",
    arguments: [GOOGLE_CUSTOMER_ARG],
  },
  {
    name: "google-asset-performance",
    description:
      "Categorize every Google App Campaign asset (video, image, text) by health status using actual CPI — not Google's built-in performance label, which measures scalability not value.",
    arguments: [GOOGLE_CUSTOMER_ARG],
  },
  {
    name: "google-network-audit",
    description:
      "Analyze Google App Campaign spend distribution across Search, Display, and YouTube networks — identifies network-level CPI drag, traffic shifts, and placement waste.",
    arguments: [GOOGLE_CUSTOMER_ARG],
  },
  {
    name: "google-architecture-review",
    description:
      "Structure-only audit of Google App Campaigns — checks campaign types, ad group setup, audience exclusions (existing users), and bid strategy prerequisites.",
    arguments: [GOOGLE_CUSTOMER_ARG],
  },
  {
    name: "google-bid-strategy",
    description:
      "Evaluate Google App Campaign bid strategy — checks signal volume thresholds, assesses tROAS readiness, and provides safe bid/budget adjustment sequences.",
    arguments: [GOOGLE_CUSTOMER_ARG],
  },
];
