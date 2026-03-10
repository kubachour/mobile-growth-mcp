# mobile-growth-mcp

MCP server for mobile growth & user acquisition on Meta (Google Ads coming too!). Connect to your LLM (Claude, ChatGPT, Gemini, Codex) to get a curated knowledge base of best practices for each ad network. More networks and insights to come — that's a promise!

## Install

```bash
npm init -y && npm install mobile-growth-mcp
```

You'll need an API key — get one from the person who set up your account.

## Setup

Add this to your MCP client config (Claude Desktop, Cursor, Claude Code, Codex, etc.):

```json
{
  "mcpServers": {
    "mobile-growth": {
      "command": "npx",
      "args": ["-y", "mobile-growth-mcp"],
      "env": {
        "API_KEY": "me_your-api-key",
        "META_ACCESS_TOKEN": "your-meta-access-token"
      }
    }
  }
}
```

- `API_KEY` (required) — authenticates with the knowledge base. You'll get this when your account is created.
- `META_ACCESS_TOKEN` (optional) — enables Meta Marketing API tools. Without it, knowledge base tools still work.

## What you get

**Knowledge base tools** — search, browse, and retrieve expert insights on creative strategy, audience targeting, scaling, bid optimization, and more.

**Meta Marketing API tools** — pull campaigns, ad sets, ads, and performance insights directly from your Meta ad account. Your access token stays local.

**9 pre-built report prompts** — ad fatigue detection, weekly performance snapshots, creative health categorization, placement audits, audience composition, architecture reviews, campaign comparisons, attribution analysis, and full account audits.

## Tools

| Tool | Description |
|------|-------------|
| `search_insights` | Semantic + keyword hybrid search across curated insights |
| `get_insight` | Full content of a specific insight by slug or ID |
| `get_meta_campaigns` | List campaigns with objectives, budgets, bid strategies |
| `get_meta_adsets` | List ad sets with targeting and optimization goals |
| `get_meta_ads` | List ads with creative info |
| `get_meta_insights` | Performance data with breakdowns, date ranges, levels |
| `get_meta_ad_fatigue` | Built-in creative fatigue detection report |

## Report prompts

Each prompt takes an `ad_account_id` and walks the LLM through a structured analysis:

- **ad-fatigue-report** — frequency, CTR decline, CPA trends
- **weekly-performance** — week-over-week health with Kast diagnostic framework
- **creative-performance** — categorize ads as scaling/promising/contributing/fatiguing/dead weight
- **audience-composition** — age x gender CPA heatmap
- **architecture-review** — campaign structure evaluation
- **audit-meta-account** — comprehensive account audit (6+ API calls)
- **campaign-comparison** — side-by-side campaign analysis
- **placement-audit** — placement waste quantification
- **attribution-analysis** — conversion quality validation

## License

MIT
