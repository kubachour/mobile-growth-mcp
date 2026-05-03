# mobile-growth-mcp

[![npm](https://img.shields.io/npm/v/mobile-growth-mcp)](https://www.npmjs.com/package/mobile-growth-mcp)

MCP server for mobile growth & user acquisition. Connects your LLM to a curated knowledge base of ad optimization insights and a library of analytical skills (campaign audits, fatigue detection, weekly diagnostics). Focused on subscription apps.

For **Meta Ads data**, use Meta's official [Meta Ads MCP / AI connector](https://www.facebook.com/business/news/meta-ads-ai-connectors). The skills here interpret what it returns. This MCP intentionally does **not** ship Meta API tools — keeping users on the official path.

For **Google Ads**, this MCP includes direct API integration (your tokens stay on your machine).

## Quick Start

### Claude Desktop

1. Open the config file:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. Add this to the file (create it if it doesn't exist):

```json
{
  "mcpServers": {
    "mobile-growth": {
      "command": "npx",
      "args": ["-y", "mobile-growth-mcp"],
      "env": {
        "API_KEY": "me_YOUR_KEY"
      }
    }
  }
}
```

3. Replace `me_YOUR_KEY` with the API key from your account admin.
4. Restart Claude Desktop.
5. To analyze Meta data, also install Meta's official Meta Ads MCP — its connector data flows through your LLM into the skills here.

> **Note**: Use the JSON config file, not the "Add custom connector" UI in Claude Desktop. That UI is for remote servers — this MCP runs locally.

### Other clients

| Client | Config file |
|--------|------------|
| Claude Code | `.mcp.json` in your project root |
| Cursor | `.cursor/mcp.json` |
| Codex | MCP config in your Codex setup |

Same JSON format as above.

### Alternative: CLI args

```json
{
  "mcpServers": {
    "mobile-growth": {
      "command": "npx",
      "args": ["-y", "mobile-growth-mcp", "--api-key=me_YOUR_KEY"]
    }
  }
}
```

### No API key?

The server still starts — you get the Google Ads tools (if configured) and a `connection_status` tool that explains what's missing and how to fix it.

## How It Works

The MCP server runs as a **local process** on your machine, started by your MCP client (Claude Desktop, Cursor, etc.).

- **Knowledge base** (remote) — curated expert insights hosted on our server, accessed via your API key
- **Google Ads API** (local) — calls happen directly from your machine using your tokens
- **Meta Ads data** — sourced from Meta's official AI connector, not from this MCP

```
Your machine                          Our server
+---------------------------+         +------------------+
| MCP client (Claude, etc.) |         |                  |
|   |                       |         |  Knowledge base  |
|   v                       |  API    |  (insights,      |
| mobile-growth-mcp --------+--key--->|   search,        |
|   |                       |         |   embeddings)    |
|   |                       |         +------------------+
|   v
| Google Ads API (your tokens stay local)
|
| (Meta Ads data: comes via Meta's official AI connector,
|  not through this MCP)
+---------------------------+
```

Your ad platform tokens are used locally and are never sent to our servers.

## What You Get

**Knowledge base tools** — search, browse, and retrieve expert insights on creative strategy, audience targeting, scaling, bid optimization, and more.

**Google Ads API tools** — pull campaigns, ad groups, assets, performance insights, and network mix directly from your Google Ads account.

**Analytical skills (MCP prompts)** — KB-grounded methodologies for ad fatigue, weekly performance, creative health, placement audits, audience composition, architecture reviews, campaign comparisons, attribution analysis, and full account audits. The Meta-flavored skills consume data from Meta's official AI connector or pasted CSVs.

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

## Report Prompts (Skills)

Each Meta-flavored prompt takes an `ad_account_id` and walks the LLM through a structured analysis. Data comes from Meta's official AI connector or pasted CSV exports.

| Prompt | Description |
|--------|-------------|
| `ad-fatigue-report` | Detect creative fatigue with daily granularity |
| `weekly-performance` | Week-over-week health with Kast diagnostic framework |
| `creative-performance` | Categorize ads: scaling / promising / fatiguing / dead weight |
| `audience-composition` | Age × gender heatmap with CPA analysis |
| `architecture-review` | Campaign structure evaluation |
| `audit-meta-account` | Comprehensive account audit |
| `campaign-comparison` | Side-by-side campaign comparison |
| `placement-audit` | Detailed placement audit with waste quantification |
| `attribution-analysis` | Conversion quality validation |
| `google-campaign-health` | Google App Campaign WoW health check |
| `google-asset-performance` | Google asset categorization by actual CPI |
| `google-network-audit` | Search/Display/YouTube spend analysis |
| `google-architecture-review` | Google App Campaign structure audit |
| `google-bid-strategy` | Google bid strategy + signal volume evaluation |

All reports reference specific knowledge base insight IDs so recommendations are grounded in expert knowledge, not generic advice.

## Resources

| URI | Description |
|-----|-------------|
| `vocabulary://tags` | Topic tags, applies_to tags, and platforms with counts |
| `instructions://getting-started` | Full guide to tools, reports, and usage |

---

## Development

### Setup

```bash
git clone https://github.com/kubachour/mobile-growth-mcp.git && cd mobile-growth-mcp
npm install
npm run build
```

### Environment

```bash
cp .env.example .env
# Fill in API_KEY (get from admin)
# For Google Ads tools: run `npx mobile-growth-mcp auth google` to set up
# For ingestion/admin: also set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

### Adding Insights

1. Create or edit JSON files in `data/insights/`
2. Follow the schema in `packages/shared/src/types.ts`
3. Run `npm run ingest`
4. Embeddings are generated automatically server-side

### Publishing

```bash
cd packages/mcp-server
npm version patch
npm publish --access public
```

### Project Structure

```
packages/shared/       — Types, Supabase client
packages/mcp-server/   — MCP server (published as mobile-growth-mcp)
  src/google/          — Google Ads API client
  src/tools/           — All MCP tools (KB + Google Ads)
  src/resources/       — MCP resources (vocabulary, instructions)
packages/ingestion/    — CLI to validate & upsert insight JSONs
data/insights/         — Curated insight JSON files
skills/                — Skill markdown files (analytical methodologies)
supabase/migrations/   — SQL migrations
supabase/functions/    — Edge Functions (embed, search)
```

## License

This project uses a dual license:

- **Code** (everything except `skills/`) — [MIT License](LICENSE)
- **Skill prompts** (`skills/*.md`) — [CC BY-NC-SA 4.0](skills/LICENSE) — you can read, learn from, and adapt them for non-commercial use, but you can't use them to build a competing commercial product

The curated knowledge base is not included in this repository.
