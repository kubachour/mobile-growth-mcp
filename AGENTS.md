# Mobile Growth MCP — Agent Instructions

You have access to a Mobile Growth MCP server with tools for querying an expert knowledge base and pulling live Meta Marketing API data. Use these tools to help users optimize their mobile advertising campaigns, particularly subscription app user acquisition on Meta.

## MCP Tools

### Knowledge Base Tools
- **search_insights**(query, topics?, applies_to?, limit?) — Semantic + keyword hybrid search across curated industry insights
- **list_insights**(topic?, applies_to?) — Browse all insights with optional filtering
- **get_insight**(id) — Full content of a specific insight by slug (e.g. "mb-li-001") or numeric ID

### Meta Marketing API Tools (require META_ACCESS_TOKEN)
- **get_meta_campaigns**(ad_account_id, fields?, effective_status?, limit?, after?) — List campaigns. Defaults: active only, lean fields.
- **get_meta_adsets**(ad_account_id, campaign_id?, fields?, effective_status?, limit?, after?) — List ad sets, optionally scoped to a campaign.
- **get_meta_ads**(ad_account_id, adset_id?, fields?, effective_status?, limit?, after?) — List ads, optionally scoped to an ad set.
- **get_meta_insights**(ad_account_id, level?, fields?, date_preset?, time_range?, time_increment?, breakdowns?, filtering?, conversion_event?, sort?, limit?, after?) — Performance data with configurable breakdowns, levels, and date ranges. Default: campaign-level, last_7d, active only.
- **get_meta_ad_fatigue**(ad_account_id, campaign_id?, conversion_event?, frequency_warning?, frequency_critical?, ctr_decline_threshold?) — Built-in creative fatigue detection report.

### MCP Prompts (Reports)
Pre-built analysis workflows. Each takes `ad_account_id` as input:

| Prompt | Purpose | API Calls |
|--------|---------|-----------|
| ad-fatigue-report | Detect creative fatigue | 1 |
| weekly-performance | Week-over-week health comparison | 2 |
| creative-performance | Categorize ads by health status | 1 |
| audience-composition | Age × gender CPA analysis | 1-2 |
| architecture-review | Campaign structure evaluation | 3 |
| audit-meta-account | Comprehensive account audit | 6+ |
| campaign-comparison | Side-by-side comparison | 3+ |
| placement-audit | Placement waste quantification | 1/campaign |
| attribution-analysis | Conversion quality validation | 2+ |

## Critical Constraints

### Rate Limit Safety
- All Meta tools default to `last_7d`, `effective_status=["ACTIVE"]`, minimal field sets
- No auto-pagination — tools return the first page + a cursor for explicit next-page requests
- The `X-FB-Ads-Insights-Throttle` header is monitored; warnings appear at >75% utilization
- Error 190 = expired token, errors 4/17/80000+ = rate limits — surface clear messages to the user

### Conversion Event
Default: `mobile_app_install`. Configurable per call via `conversion_event` parameter. Always confirm the user's primary conversion event before running reports.

### Without META_ACCESS_TOKEN
Meta tools return a clear error. Knowledge base tools (`search_insights`, `list_insights`, `get_insight`) still work independently.

## Reports — How to Run

### Ad Fatigue Report
Call `get_meta_ad_fatigue(ad_account_id)`. Analyzes frequency, CTR decline, CPA trends per ad over 7 days at daily granularity.

Diagnosis framework [wk-tw-001]:
- High frequency + rising CPA → audience saturation
- Declining CTR + rising CPA → creative fatigue

Recommendations: genuinely new creatives (25% different [lp-pt-001]), new hooks [oh-li-005], don't re-test degraded creatives for 3-6 months [vs-nt-002].

### Weekly Performance Snapshot
Two calls: `get_meta_insights(date_preset="this_week_mon_today")` and `get_meta_insights(date_preset="last_week_mon_sun")`.

Compute deltas, apply Kast's 4 diagnostic patterns [wk-tw-001]:
1. Frequency↑ + CPA↑ → creative fatigue
2. CPM↑ + CPA↑ → audience saturation
3. CPA↑ + CVR↓ → ad-to-LP mismatch
4. CTR↓ + CPA↑ → creative fatigue

End with: "Analyze first, optimize second" [ds-pt-008].

### Creative Performance Report
`get_meta_insights(level="ad", sort="spend_descending", limit=50)`.

Categorize each ad:
- **Scaling**: High spend, CPA ≤ target → let it run [mb-li-001]
- **Promising**: Low spend, CPA ≤ target → don't force spend [ds-pt-004]
- **Contributing**: Low conversions but ad set healthy → halo role [jl-pt-004, lp-pt-003]
- **Fatiguing**: Frequency >3, CTR declining → prepare replacement [oh-li-001]
- **Dead weight**: High spend, CPA >2x target → pause only if ad set also bad [jl-pt-004]

### Placement Efficiency Report
`get_meta_insights(breakdowns="publisher_platform,platform_position")`.

Known waste placements for app installs: `facebook/instream_video`, `facebook/facebook_reels_overlay`, `threads/threads_feed`, `audience_network/classic`. Flag CPI >3x average. Consider Placement Value Rules [mb-li-009] as alternative to restriction.

### Audience Composition Report
`get_meta_insights(level="account", breakdowns="age,gender")`.

Key insight [mb-li-010]: 35+ users convert 2-3x better for subscription apps. App Promotion campaigns skew young [mb-li-006]. Recommend Value Rules for age-based bid modifiers [mb-li-008].

### Campaign Architecture Review
Three calls: `get_meta_campaigns`, `get_meta_adsets`, `get_meta_ads` (structure only, no insights).

Checks: over-consolidation [mb-li-002], creative count [lp-pt-002, ds-pt-005], campaign type diversity [mb-li-006], optimization events [mb-li-003], EAC opportunity [mb-cd-001], zombie campaign [br-li-002].

### Full Account Audit
Most comprehensive. 6+ API calls covering structure + performance + breakdowns. See `skills/audit-meta-account.md` for full procedure. References all relevant knowledge base insights.

### Campaign Comparison
Compare two campaigns: pull settings, ad sets, insights. Apply Kast diagnostic framework [wk-tw-001]. Check creative similarity [oh-li-001] and attribution contribution [lp-pt-003].

### Attribution Analysis
Validate conversion quality using daily time-series (`time_increment="1"`). Check view-through ratios, delayed attribution uplift, and daily CPI consistency. Remember: contribution vs attribution [lp-pt-003].

## Key Knowledge Base Insight IDs

These are the most frequently cited insights across all reports:

| ID | Author | Core Point |
|----|--------|------------|
| wk-tw-001 | William Kast | 4 diagnostic metric patterns (the core framework) |
| ds-pt-001 | Dara Saeed | Primary metrics decide, secondary metrics explain |
| ds-pt-003 | Dara Saeed | Frequency >5 over 7 days = saturation |
| ds-pt-004 | Dara Saeed | Don't force spend to low-spend winners |
| ds-pt-005 | Dara Saeed | ASC needs minimum 20 creatives |
| ds-pt-008 | Dara Saeed | Analyze first, optimize second |
| mb-li-001 | Marcus Burke | Creative unlocks scale, iterations maintain it |
| mb-li-002 | Marcus Burke | Deconsolidation — split creative types |
| mb-li-003 | Marcus Burke | Signal quality > signal volume |
| mb-li-005 | Marcus Burke | One price = one audience |
| mb-li-006 | Marcus Burke | App Promotion skews young, Web Sales skews older |
| mb-li-008 | Marcus Burke | Value Rules for age/gender bid modifiers |
| mb-li-009 | Marcus Burke | Placement-level Value Rules |
| mb-li-010 | Marcus Burke | Age-based conversion rates (35+ converts 2-3x better) |
| mb-cd-001 | Marcus Burke | EAC for subscription apps |
| oh-li-001 | Olly Hudson | Andromeda treats similar first 3 seconds as identical |
| oh-li-003 | Olly Hudson | Persona-based ads unlock 89% new audiences |
| lp-pt-001 | Lauren Petrullo | 25% visual difference required for Andromeda |
| lp-pt-002 | Lauren Petrullo | Minimum 6 creatives per offering |
| lp-pt-003 | Lauren Petrullo | Contribution vs attribution — don't kill funnel feeders |
| jl-pt-004 | Jon Loomer | Don't turn off underperformers if aggregate is good |
| vs-nt-001 | Virendra Shekhawat | Meta auto-shifts spend from degrading creatives |
| vs-nt-002 | Virendra Shekhawat | Don't re-test degraded creatives for 3-6 months |
| br-li-001 | Ben Radack | CBO scaling with monthly winner rotation |
| br-li-002 | Ben Radack | Zombie campaign for creative recovery |

Use `get_insight(id="slug")` to read the full content of any insight before citing it.

## Content Ingestion

When the user provides raw content to add to the knowledge base:

1. Extract insights following the schema in `skills/extract-insights.md`
2. Present summary for user approval
3. Save to `data/insights/{author}-{source}-{descriptor}.json`
4. Run `npm run build && npm run ingest`
5. Verify with `search_insights`

See `skills/ingest-content.md` for the complete pipeline.

## Project Structure

```
packages/mcp-server/src/meta/                — Meta API client + types
packages/mcp-server/src/tools/               — All MCP tools (knowledge base + Meta)
packages/mcp-server/src/remote-proxy.ts      — Proxies KB tools + prompts from Edge Function
packages/shared/src/                         — Types, Supabase client
skills/                                      — Canonical skill .md files (source of truth for prompts)
supabase/functions/_shared/prompts.ts        — Prompt manifest (metadata)
supabase/functions/_shared/prompt-content.ts — Generated from skills/*.md
data/insights/                               — Curated insight JSON files
```

Prompts are served from the Edge Function, not bundled in the npm package. Updating a skill requires only `npm run build:prompts` + Edge Function deploy — no npm republish needed.

## Development Commands

```bash
npm run build           # Build all packages
npm run build:prompts   # Generate prompt-content.ts from skills/*.md
npm run ingest          # Validate & upsert insights to Supabase
# Deploy prompts: npm run build:prompts && supabase functions deploy mcp --no-verify-jwt
```
