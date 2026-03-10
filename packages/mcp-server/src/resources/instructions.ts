import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const INSTRUCTIONS = `# Mobile Growth MCP — Knowledge Base + Meta Ad Tools

## What This Is
A curated knowledge base of mobile advertising insights + direct Meta Marketing API integration. Query expert knowledge, pull live campaign data, and run pre-built reports — all from your LLM.

## Knowledge Base Tools

### search_insights
Semantic + keyword hybrid search across the knowledge base.
- **query** (required): Natural language search query
- **topics** (optional): Filter by topic tags, e.g. ["creative_strategy", "scaling"]
- **applies_to** (optional): Filter by applicability, e.g. ["subscription_apps", "ios"]
- **limit** (optional): Max results, 1-30, default 10

### list_insights
Browse all insights with optional filtering. Returns titles and metadata.
- **topic** (optional): Filter by a single topic tag
- **applies_to** (optional): Filter by a single applies_to value

### get_insight
Fetch the full content of a specific insight by ID or slug.
- **id** (required): Numeric ID or string slug (e.g. "mb-li-001")

## Meta Marketing API Tools

**Requires META_ACCESS_TOKEN env var** — without it, these tools return a clear error. Knowledge base tools work with just API_KEY.

**Rate limit safety**: All tools default to last_7d, active-only, minimal fields. No auto-pagination. Throttle header monitored — warns at >75% utilization.

### get_meta_campaigns
List campaigns from a Meta ad account. Defaults to active campaigns.
- **ad_account_id** (required): e.g. "act_123456789"
- **fields, effective_status, limit, after** (optional)

### get_meta_adsets
List ad sets, optionally scoped to a campaign.
- **ad_account_id** (required)
- **campaign_id** (optional): Scope to specific campaign
- **fields, effective_status, limit, after** (optional)

### get_meta_ads
List ads, optionally scoped to an ad set.
- **ad_account_id** (required)
- **adset_id** (optional): Scope to specific ad set
- **fields, effective_status, limit, after** (optional)

### get_meta_insights
Pull performance insights with configurable level, breakdowns, date range.
- **ad_account_id** (required)
- **level** (optional): account, campaign, adset, ad (default: campaign)
- **date_preset** (optional): default last_7d
- **time_range** (optional): {since, until} for custom dates
- **time_increment** (optional): "1" for daily, "7" for weekly
- **breakdowns** (optional): e.g. "age,gender" or "publisher_platform,platform_position"
- **conversion_event** (optional): default "mobile_app_install"
- **fields, filtering, sort, limit, after** (optional)

### get_meta_ad_fatigue
Built-in report: detect creative fatigue via frequency, CTR decline, CPA trends.
- **ad_account_id** (required)
- **campaign_id** (optional): Scope to specific campaign
- **conversion_event** (optional): default "mobile_app_install"
- **frequency_warning** (optional): default 3
- **frequency_critical** (optional): default 5
- **ctr_decline_threshold** (optional): default 30%

## Reports (MCP Prompts)

Pre-built analysis workflows. Select a prompt and provide your ad_account_id to run:

| Prompt | What it does | API calls |
|--------|-------------|-----------|
| ad-fatigue-report | Detect creative fatigue with daily granularity | 1 |
| weekly-performance | Week-over-week health comparison with diagnosis | 2 |
| creative-performance | Categorize ads by health status | 1 |
| placement-efficiency | Identify placement waste and savings | 1 per campaign |
| audience-composition | Age × gender heatmap with CPA analysis | 1-2 |
| architecture-review | Campaign structure evaluation | 3 (no insights) |
| audit-meta-account | Comprehensive account audit | 6+ |
| campaign-comparison | Side-by-side campaign comparison | 3+ |
| placement-audit | Detailed placement audit with examples | 1 per campaign |
| attribution-analysis | Conversion quality validation | 2+ |

## Resources

### vocabulary://tags
Lists all topic tags, applies_to tags, and platforms with counts.

## Tips
- Start with \`list_insights\` to see what's in the knowledge base
- Use \`search_insights\` to find specific advice grounded in expert knowledge
- Meta tools default to safe parameters (last_7d, active-only) to avoid rate limits
- Reports reference specific knowledge base insight IDs — use \`get_insight\` to read the full context
- For custom date ranges, use time_range instead of date_preset
`;

export function registerInstructionsResource(server: McpServer): void {
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
          text: INSTRUCTIONS,
        },
      ],
    })
  );
}
