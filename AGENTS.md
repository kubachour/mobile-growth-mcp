# Mobile Growth MCP — Agent Instructions

You have access to a Mobile Growth MCP server: an expert knowledge base for mobile growth (search it, and save new learnings into it), KB-grounded audit skills for Google App Campaigns, and tools to upload images and videos to Google Ads.

- **Answer from the KB first:** `search_insights` before advising or searching the web; cite author + slug.
- **Capture proactively:** when the user shares a link, post, podcast or screenshot, run `extract-insights` and save with ONE `suggest_insight` call (`insights` array).
- **Read ad data via official MCPs:** Google Ads MCP (GAQL `search`) for Google; Meta's official connector for Meta.
- **Uploads:** always `dry_run=true` first and show the plan.

## MCP Tools

| Tool | Description |
|------|-------------|
| `connection_status` | Check KB and Google Ads upload status; shows how to fix issues |
| `search_insights` | Semantic + keyword hybrid search across curated insights |
| `get_insight` | Full content of a specific insight by slug or ID |
| `get_vocabulary_counts` | Topic and applies_to tag counts |
| `suggest_insight` | Save insights from a source — batch up to 20 per call; admin keys publish immediately |
| `save_private_insight` | Save client-specific knowledge visible only to your key |
| `suggest_skill` / `submit_feedback` | Propose a workflow / report a KB gap or bug |
| `upload_google_image_assets` | Upload images (URLs or files) as assets; optionally add them to an App campaign ad |
| `upload_google_video_assets` | Add YouTube videos as assets (deduplicated by video ID); optionally add them to an App campaign ad |
| `add_assets_to_app_ad` | Append images, videos, headlines or descriptions to an App campaign ad, within Google's caps |

Admin keys also get `review_suggestions`, `approve_suggestion`, `reject_suggestion`, the skill-suggestion equivalents, `list_insights`, `delete_insight` and `suggest_improvement`.

**Reading Google Ads data** is done by the official [Google Ads MCP](https://github.com/googleads/google-ads-mcp) (read-only GAQL). The Google skills below list the exact queries to run. **Meta data** comes from Meta's official Meta Ads MCP / AI connector.

## MCP Prompts

| Prompt | Description |
|--------|-------------|
| `extract-insights` | Turn a link, post, podcast or screenshot into insights and save them in one call |
| `google-account-audit` | Full Google App Campaigns audit against the KB: signal, conversion windows, tROAS, exclusions, audience signals, assets, network, iOS ODM/ICM |
| `google-campaign-health` | Week-over-week health check and algorithm thresholds |
| `google-asset-performance` | Asset categorization by actual CPI, gaps and refresh plan |
| `google-network-audit` | Search / Display / YouTube spend and CPI analysis, placements |
| `google-architecture-review` | Campaign and ad group structure, exclusions and signals |
| `google-bid-strategy` | Bid strategy, conversion window vs tROAS target, safe change sizes |
| `admin-briefing` | Admin: pending suggestions, bugs, knowledge gaps |

Every skill cites knowledge base insight IDs, so recommendations are grounded in expert knowledge. Meta skills are archived in `skills/archive/`.

## Reports — How to Run

Each Google skill lists the GAQL queries to run through the Google Ads MCP (Option A) and a CSV fallback (Option B). Read the relevant `skills/*.md` for the exact procedure. Run `google-account-audit` for a full review; the others go deeper on one area.

> The table below still includes Meta insight IDs used by the archived Meta skills; they remain searchable in the KB.

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
