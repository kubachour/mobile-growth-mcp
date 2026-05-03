import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StartupStatus } from "../tools/connection-status.js";

const INSTRUCTIONS = `# Mobile Growth MCP — Knowledge Base + Analysis Skills

## Welcome

You're connected to the Mobile Growth knowledge base — curated expert insights on mobile advertising, campaign optimization, and subscription app growth — plus Google Ads API integration and a library of analytical skills.

**The knowledge base is always on.** Use \`search_insights\` freely — before making recommendations, when diagnosing issues, or exploring strategies. The more specific your query, the better the results.

> **For Meta Ads data**, use Meta's official Meta Ads MCP / AI connector. This MCP intentionally does **not** ship Meta API tools — instead, the analytical skills here (ad-fatigue-report, weekly-performance, audit-meta-account, etc.) interpret data fetched from Meta's official connector or pasted from CSV exports.
>
> Connecting Google Ads is optional. The knowledge base, community suggestions, and private insights all work with just your API key.

Quick examples:
- "subscription app creative fatigue signals"
- "Meta CBO vs ABO tradeoffs for subscription apps"
- "Google UAC network shift detection"
- "iOS attribution strategies post-ATT"

If you can't find what you need, call \`submit_feedback\` to report the gap — it helps us improve the knowledge base.

## What This Is
A curated knowledge base of mobile advertising insights + Google Ads API integration + analytical skills (Meta + Google) that interpret data from the platforms' own MCPs/CSV exports.

---

## Knowledge Base Tools

### search_insights
Semantic + keyword hybrid search across the knowledge base. **Use this first** for any question about mobile advertising before searching the web.
- **query** (required): Natural language search query
- **topics** (optional): Filter by topic tags, e.g. ["creative_strategy", "scaling"]
- **applies_to** (optional): Filter by applicability, e.g. ["subscription_apps", "ios"]
- **limit** (optional): Max results, 1-30, default 10

### list_insights
Browse all insights with optional filtering. Returns titles and metadata. Private insights are marked with a lock icon.
- **topic** (optional): Filter by a single topic tag
- **applies_to** (optional): Filter by a single applies_to value

### get_insight
Fetch the full content of a specific insight by ID or slug.
- **id** (required): Numeric ID or string slug (e.g. "mb-li-001")

### get_vocabulary_counts
Returns counts of how many insights use each topic and applies_to tag. Lightweight way to explore what's in the KB.

### submit_feedback
Report a gap in the knowledge base, a bug in any tool, or a missing capability.
- **category** (required): missing_knowledge, missing_feature, search_quality, bug_report, or other
- **summary** (required): What was needed or what went wrong (anonymized — no account IDs or tokens)
- **search_queries_tried** (optional): Search queries that returned poor/no results

## Community Knowledge

### suggest_insight ⭐ DEFAULT for saving knowledge
Submit knowledge for admin review. **This is the default tool when a user wants to save an insight** — it contributes to the shared knowledge base that benefits all users. Extract as much structured data as possible from the source material — full insight schema (title, insight text, source metadata, topics, actionable steps). Once approved, it's added to the shared knowledge base.
- Use this when the user shares an article, post, or discussion with valuable mobile growth knowledge
- Keep raw_excerpt concise (under 500 chars) for reliability

### save_private_insight
Save knowledge that is private to your API key. Immediately searchable but only visible to you. **Only use this instead of suggest_insight when** the content contains client-specific data, internal benchmarks, account metrics, or the user explicitly asks for private storage.
- Same full schema as suggest_insight
- No admin approval needed — saved instantly

### suggest_skill
Propose a new skill (repeatable workflow) for the knowledge base. **Use this when a user describes a workflow they want automated** — recurring audits, analyses, or procedures they run regularly.
- **Before calling**: draft the full skill .md yourself. Canonical format: "## What It Does", "## When to Use This" (bullet triggers), "## What It Needs" (data sources + exact CSV export instructions), "## Procedure" (numbered steps with tool calls or CSV column specs), "## Output".
- Pass the draft as content_md. Only use user_description without a draft if the user wants to submit a rough idea for the admin to develop.
- Provide when_to_use phrases and data_sources (meta_api / google_ads_api / csv / manual_input)
- Submissions go to admin review before becoming live

---

## Meta Ads Data — Use Meta's Official AI Connector

This MCP **does not ship Meta API tools**. Use Meta's official Meta Ads MCP / AI connector to fetch campaign data, performance metrics, audiences, and catalog operations. Then run the analytical skills below to interpret what comes back.

This separation keeps users out of unofficial-API risk while preserving the analytical value (KB-grounded methodology) that this MCP provides.

---

## Google Ads Tools

**Requires Google Ads credentials** — run \`npx mobile-growth-mcp auth google\` to set up interactively. Credentials are saved to \`.env\` and never leave the user's machine.

All tools accept campaign and ad group IDs as either **numeric IDs** or **campaign/ad group names** — names are auto-resolved to numeric IDs internally.

### get_google_ads_campaigns
List Google App Campaigns with status, bid strategy, budgets, and app info. Returns **numeric campaign IDs** needed by other tools.
- **customer_id** (required): Google Ads customer ID (e.g. "123-456-7890")
- **status** (optional): Filter by status — ENABLED, PAUSED, REMOVED (default: ["ENABLED"])
- **channel_sub_type** (optional): Filter by campaign type — APP_CAMPAIGN (ACi), APP_CAMPAIGN_FOR_ENGAGEMENT (ACe)
- **limit** (optional): Max campaigns to return (default 50)

### get_google_ad_groups
List ad groups within Google App Campaigns. Returns **numeric ad group IDs** and campaign IDs. In UAC, ad groups represent creative themes — observe spend distribution to identify winning messaging angles.
- **customer_id** (required): Google Ads customer ID
- **campaign_id** (optional): Scope to a specific campaign (name or numeric ID)
- **status** (optional): Filter by status (default: ["ENABLED"])
- **limit** (optional): Max results (default 50)

### get_google_insights
Pull performance metrics with configurable level, breakdowns, date ranges, and time granularity. Use **network breakdown** to detect traffic shifts between Search, Display/AdMob, and YouTube — the #1 diagnostic lever for Google campaigns.
- **customer_id** (required): Google Ads customer ID
- **level** (optional): account, campaign, ad_group, asset (default: campaign)
- **campaign_id** (optional): Scope to specific campaign (name or numeric ID)
- **ad_group_id** (optional): Scope to specific ad group
- **breakdown** (optional): network or device (one at a time — GAQL restriction)
- **date_range** (optional): {start_date, end_date} in YYYY-MM-DD
- **date_preset** (optional): LAST_7_DAYS, LAST_14_DAYS, LAST_30_DAYS, THIS_MONTH, LAST_MONTH
- **time_increment** (optional): daily, weekly, monthly, summary (default: summary)
- **sort** (optional): cost_desc, conversions_desc, impressions_desc, ctr_desc
- **limit** (optional): Max results (default 50, max 500)

### get_google_assets
List creative assets with metadata, performance labels, and slot utilization audit. Checks headlines, descriptions, images, videos against Google's per-slot maximums.
- **customer_id** (required): Google Ads customer ID
- **campaign_id** (optional): Scope to a specific campaign (name or numeric ID)
- **ad_group_id** (optional): Scope to a specific ad group
- **asset_type** (optional): IMAGE, YOUTUBE_VIDEO, TEXT, MEDIA_BUNDLE
- **include_slot_audit** (optional): default true
- **limit** (optional): Max results (default 50)

### get_google_network_mix
Analyze traffic distribution across Google's ad networks (Search, Display/AdMob, YouTube) over time. Flags significant shifts in spend share — a sudden shift to Display/MGDN typically tanks CPA.
- **customer_id** (required): Google Ads customer ID
- **campaign_id** (optional): Scope to one campaign (name or numeric ID)
- **date_range** (optional): {start_date, end_date} — default last 14 days
- **shift_threshold_pct** (optional): Flag networks with spend share change > this % (default 10)

### get_google_asset_fatigue
Detect creative asset fatigue by analyzing per-asset impression trends, CTR decline, and CPA deterioration. Checks asset age against Google's 2-week learning minimum and 2-3 month refresh cadence.
- **customer_id** (required): Google Ads customer ID
- **campaign_id** (required): Campaign to analyze (name or numeric ID)
- **ad_group_id** (optional): Scope to specific ad group
- **lookback_days** (optional): Days of data to analyze, 7-90 (default 14)
- **ctr_decline_threshold_pct** (optional): CTR decline % to flag (default 30)
- **impression_decay_threshold_pct** (optional): Impression drop % to flag (default 50)
- **asset_type** (optional): IMAGE, YOUTUBE_VIDEO, TEXT

---

## Reports (MCP Prompts)

Pre-built analytical workflows. Each skill expects either Meta MCP–sourced data (use Meta's official AI connector) or CSV exports from Ads Manager. Select a prompt and provide your \`ad_account_id\` to run:

| Prompt | What it does |
|--------|-------------|
| ad-fatigue-report | Detect creative fatigue with daily granularity |
| weekly-performance | Week-over-week health comparison with diagnosis |
| creative-performance | Categorize ads by health status |
| audience-composition | Age × gender heatmap with CPA analysis |
| architecture-review | Campaign structure evaluation |
| audit-meta-account | Comprehensive account audit |
| campaign-comparison | Side-by-side campaign comparison |
| placement-audit | Detailed placement audit with examples |
| attribution-analysis | Conversion quality validation |

---

## Resources

### vocabulary://tags
Lists all topic tags, applies_to tags, and platforms with counts.

## Presenting Results

When your response draws on knowledge base results, **always attribute visibly** so the user knows the value came from the curated KB, not your general training data:

- **Tell the user** the information comes from the Mobile Growth knowledge base (e.g. "According to the Mobile Growth KB..." or "The knowledge base recommends...")
- **Cite source author + slug** for key claims (e.g. "...(source: Eric Seufert, \`mb-li-001\`)")
- **When multiple insights support a recommendation**, mention the count (e.g. "3 insights in the KB agree that...")
- **Distinguish KB-sourced advice from your own reasoning** — if you're adding your own analysis on top of KB results, make that clear

## Workflow Tips

### For Google Ads analysis:
1. Start with \`get_google_ads_campaigns\` to see campaigns and get numeric IDs
2. Use \`get_google_insights\` with network breakdown to check traffic distribution
3. Use \`get_google_network_mix\` if you suspect network shifts
4. Use \`get_google_assets\` to audit creative slot utilization
5. Use \`get_google_asset_fatigue\` on specific campaigns to detect creative decay

### For Meta analysis:
1. Use Meta's official Meta Ads MCP / AI connector to fetch the data
2. Run a report (MCP prompt) here to interpret it against the knowledge base
3. For custom analysis, ask the user to paste a CSV export and use the skill's Option B path

### General:
- Always \`search_insights\` before making recommendations — ground advice in expert knowledge
- Use \`get_insight\` to read full context when reports reference insight IDs
- Use \`suggest_insight\` (default) when a user shares valuable knowledge from articles or discussions
- Use \`save_private_insight\` only for client-specific data the user explicitly wants private
- If a tool errors unexpectedly, call \`submit_feedback\` with category \`bug_report\`
`;

function buildStatusSection(status?: StartupStatus): string {
  if (!status) return "";

  const lines: string[] = ["\n## Connection Status\n"];

  if (status.kb.connected) {
    lines.push(
      `- **Knowledge Base**: Connected (${status.kb.toolCount} tools, ${status.kb.promptCount} prompts)`
    );
  } else {
    lines.push(
      `- **Knowledge Base**: Not connected — ${status.kb.error ?? "API_KEY not configured"}`
    );
    lines.push(
      "  - Fix: provide your API key via `--api-key=me_...` CLI arg, `API_KEY` env var, or `.env` file"
    );
  }

  lines.push(
    "- **Meta Ads Data**: Use Meta's official Meta Ads MCP / AI connector — this MCP no longer ships Meta API tools"
  );

  if (status.google.configured) {
    lines.push("- **Google Ads API**: Configured");
  } else {
    lines.push(
      "- **Google Ads API**: Not connected (optional — KB works without it)"
    );
    lines.push(
      "  - To connect: run `npx mobile-growth-mcp auth google` to set up credentials"
    );
  }

  return lines.join("\n");
}

export function registerInstructionsResource(
  server: McpServer,
  status?: StartupStatus
): void {
  const text = INSTRUCTIONS + buildStatusSection(status);

  server.resource(
    "instructions",
    "instructions://getting-started",
    {
      description:
        "Getting started guide explaining the knowledge base, Meta API tools, reports, and example queries. Read this first.",
      mimeType: "text/plain",
    },
    async () => ({
      contents: [
        {
          uri: "instructions://getting-started",
          mimeType: "text/plain",
          text,
        },
      ],
    })
  );
}
