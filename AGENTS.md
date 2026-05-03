# Mobile Growth MCP — Agent Instructions

You have access to a Mobile Growth MCP server with tools for querying an expert knowledge base and pulling Google Ads data, plus analytical skills for Meta and Google. Meta Ads data should be sourced via Meta's **official** Meta Ads MCP / AI connector — this MCP no longer ships Meta API tools.

Use these tools to help users optimize their mobile advertising campaigns, particularly subscription app user acquisition.

## MCP Tools

### Knowledge Base Tools
- **search_insights**(query, topics?, applies_to?, limit?) — Semantic + keyword hybrid search across curated industry insights
- **list_insights**(topic?, applies_to?) — Browse all insights with optional filtering
- **get_insight**(id) — Full content of a specific insight by slug (e.g. "mb-li-001") or numeric ID

### Meta Ads Data
This MCP **does not** expose Meta API tools. Use Meta's official Meta Ads MCP / AI connector for: campaign listings, ad set / ad data, performance insights, audience breakdowns, placement breakdowns. Then run the analytical skills (MCP prompts) here against the data Meta returns. Users can also paste CSV exports from Ads Manager — every Meta-flavored skill supports both.

### Google Ads Tools
- **get_google_ads_campaigns** / **get_google_ad_groups** / **get_google_assets** — Structure
- **get_google_insights** — Performance with network/device breakdowns
- **get_google_network_mix** — Search/Display/YouTube traffic shifts
- **get_google_asset_fatigue** — Asset-level fatigue
- **upload_google_image_assets** — Upload images to Google Ads

### MCP Prompts (Reports)
Pre-built analytical workflows. Each Meta-flavored prompt takes `ad_account_id`. Data comes from Meta's official MCP or pasted CSV.

| Prompt | Purpose |
|--------|---------|
| ad-fatigue-report | Detect creative fatigue |
| weekly-performance | Week-over-week health comparison |
| creative-performance | Categorize ads by health status |
| audience-composition | Age × gender CPA analysis |
| architecture-review | Campaign structure evaluation |
| audit-meta-account | Comprehensive account audit |
| campaign-comparison | Side-by-side comparison |
| placement-audit | Placement waste quantification |
| attribution-analysis | Conversion quality validation |
| google-campaign-health | Google App Campaign WoW health |
| google-asset-performance | Google asset categorization by CPI |
| google-network-audit | Google network mix analysis |
| google-architecture-review | Google App Campaign structure audit |
| google-bid-strategy | Google bid strategy + signals |

## Reports — How to Run

Each skill describes its own data needs (Option A — via Meta MCP / Google Ads tools / Option B — via CSV) and includes the analytical framework. Read the relevant `skills/*.md` for the exact procedure.

Highlights of the diagnostic frameworks used:

### Kast Diagnostic Framework [wk-tw-001]
1. Frequency↑ + CPA↑ → creative fatigue
2. CPM↑ + CPA↑ → audience saturation
3. CPA↑ + CVR↓ → ad-to-LP mismatch
4. CTR↓ + CPA↑ → creative fatigue

### Creative Categorization
- **Scaling**: High spend, CPA ≤ target → let it run [mb-li-001]
- **Promising**: Low spend, CPA ≤ target → don't force spend [ds-pt-004]
- **Contributing**: Low conversions but ad set healthy → halo role [jl-pt-004, lp-pt-003]
- **Fatiguing**: Frequency >3, CTR declining → prepare replacement [oh-li-001]
- **Dead weight**: High spend, CPA >2x target → pause only if ad set also bad [jl-pt-004]

### Known Meta Waste Placements (for app installs)
`facebook/instream_video`, `facebook/facebook_reels_overlay`, `threads/threads_feed`, `audience_network/classic`. Flag CPI >3x average. Consider Placement Value Rules [mb-li-009] as alternative to restriction.

### Audience Insight [mb-li-010]
35+ users convert 2-3x better for subscription apps. App Promotion campaigns skew young [mb-li-006]. Recommend Value Rules for age-based bid modifiers [mb-li-008].

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
packages/mcp-server/src/google/              — Google Ads API client + types
packages/mcp-server/src/tools/               — All MCP tools (KB + Google Ads)
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
