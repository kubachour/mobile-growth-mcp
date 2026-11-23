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

const GOOGLE_CUSTOMER_ARG: PromptArgDef = {
  name: "customer_id",
  description: "Google Ads customer ID (e.g. 123-456-7890). Data is fetched through the official Google Ads MCP (GAQL search).",
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
    name: "extract-insights",
    description:
      "Turn a link, article, podcast, post or screenshot into structured insights and save them to the knowledge base (suggest_insights).",
    arguments: [],
  },

  // Google Ads skills (data via the official Google Ads MCP)
  {
    name: "google-account-audit",
    description:
      "Full Google App Campaigns audit against KB best practices — conversion signal and windows, tROAS targets, exclusions and audience signals, asset coverage and refresh, network mix, iOS ODM/ICM checklist. Every finding cites an insight ID.",
    arguments: [GOOGLE_CUSTOMER_ARG],
  },
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
