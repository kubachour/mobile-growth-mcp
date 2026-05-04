# mobile-growth-mcp

MCP server for mobile growth & user acquisition. Connects your LLM (Claude, ChatGPT, Gemini, Codex) to a curated knowledge base of best practices for each ad network, plus Google Ads tools and analytical skills.

For **Meta Ads data**, use Meta's official Meta Ads MCP / AI connector — this MCP intentionally does **not** ship Meta API tools (keeps users on the official path). Skills here interpret data from Meta's connector or pasted CSV exports.

## Install

```bash
npm init -y && npm install mobile-growth-mcp
```

You'll need an API key — get one from the person who set up your account.

## Setup

There are three ways to provide your API key. The server checks them in this order:

### Option 1: CLI arguments

Pass the key directly in the `args` array. Works with every MCP client.

```json
{
  "mcpServers": {
    "mobile-growth": {
      "command": "npx",
      "args": ["-y", "mobile-growth-mcp", "--api-key=me_your-api-key"]
    }
  }
}
```

### Option 2: Environment variables

Use the `env` block in your MCP client config.

```json
{
  "mcpServers": {
    "mobile-growth": {
      "command": "npx",
      "args": ["-y", "mobile-growth-mcp"],
      "env": {
        "API_KEY": "me_your-api-key"
      }
    }
  }
}
```

### Option 3: `.env` file

Create a `.env` file in your working directory:

```
API_KEY=me_your-api-key
```

### Keys

- `API_KEY` — authenticates with the knowledge base. Without it, the server still starts but only the `connection_status` tool is available; call it to see what's connected.
- For **Google Ads** tools, run `npx mobile-growth-mcp auth google` to set up OAuth credentials interactively. Saved to `.env`, never sent to our servers.
- For **Meta Ads data**, install Meta's official Meta Ads MCP / AI connector alongside this one. The skills here will read from it.

## What you get

**Knowledge base tools** — search, browse, and retrieve expert insights on creative strategy, audience targeting, scaling, bid optimization, and more.

**Google Ads tools** — pull campaigns, ad groups, assets, performance insights, and network mix directly from your Google Ads account. Token stays local.

**Analytical skills (MCP prompts)** — KB-grounded methodologies for ad fatigue, weekly performance, creative health, placement audits, audience composition, architecture reviews, campaign comparisons, attribution analysis, and full account audits. The Meta-flavored skills consume data from Meta's official connector or pasted CSVs.

## Tools

| Tool | Description |
|------|-------------|
| `connection_status` | Check KB and Google Ads connection status; shows how to fix issues |
| `search_insights` | Semantic + keyword hybrid search across curated insights |
| `list_insights` | Browse all insights with optional filtering |
| `get_insight` | Full content of a specific insight by slug or ID |
| `get_google_ads_campaigns` | List Google App Campaigns with status, bid strategy, budgets |
| `get_google_ad_groups` | List ad groups within Google App Campaigns |
| `get_google_assets` | List creative assets with slot utilization audit |
| `get_google_insights` | Performance metrics with network/device breakdowns |
| `get_google_network_mix` | Detect Search ↔ Display ↔ YouTube traffic shifts |
| `get_google_asset_fatigue` | Asset-level fatigue detection |
| `upload_google_image_assets` | Upload image assets to Google Ads |

## Report prompts

Each Meta-flavored prompt takes an `ad_account_id` and walks the LLM through a structured analysis. Data comes from Meta's official AI connector or pasted CSV exports.

- **ad-fatigue-report** — frequency, CTR decline, CPA trends
- **weekly-performance** — week-over-week health with Kast diagnostic framework
- **creative-performance** — categorize ads as scaling/promising/contributing/fatiguing/dead weight
- **audience-composition** — age × gender CPA heatmap
- **architecture-review** — campaign structure evaluation
- **audit-meta-account** — comprehensive account audit
- **campaign-comparison** — side-by-side campaign analysis
- **placement-audit** — placement waste quantification
- **attribution-analysis** — conversion quality validation
- **google-campaign-health** — Google App Campaign WoW health
- **google-asset-performance** — Google asset categorization by actual CPI
- **google-network-audit** — Search/Display/YouTube spend analysis
- **google-architecture-review** — Google App Campaign structure audit
- **google-bid-strategy** — Google bid strategy + signal volume evaluation

## License

MIT
