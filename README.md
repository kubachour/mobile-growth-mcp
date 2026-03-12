# mobile-growth-mcp

[![npm](https://img.shields.io/npm/v/mobile-growth-mcp)](https://www.npmjs.com/package/mobile-growth-mcp)

MCP server for mobile growth & user acquisition. Connect your LLM to a curated knowledge base of ad optimization insights + live Meta Marketing API access. Focused on subscription apps. More networks coming.

> **Your ad platform tokens (Meta, Google Ads, TikTok) never leave your machine.** The MCP server runs locally on your computer — API calls to ad platforms happen directly from your device. We never see, store, or proxy your ad platform credentials.

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
        "API_KEY": "me_YOUR_KEY",
        "META_ACCESS_TOKEN": "your-meta-access-token"
      }
    }
  }
}
```

3. Replace `me_YOUR_KEY` with the API key from your account admin.
4. Replace `your-meta-access-token` with your Meta Marketing API token (or remove that line if you only need the knowledge base).
5. Restart Claude Desktop.

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
      "args": ["-y", "mobile-growth-mcp", "--api-key=me_YOUR_KEY", "--meta-token=YOUR_META_TOKEN"]
    }
  }
}
```

### No API key?

The server still starts — you get Meta tools and a `connection_status` tool that explains what's missing and how to fix it.

## How It Works

The MCP server runs as a **local process** on your machine, started by your MCP client (Claude Desktop, Cursor, etc.). It connects to two things:

- **Knowledge base** (remote) — curated expert insights hosted on our server, accessed via your API key
- **Ad platform APIs** (local) — Meta, Google Ads, TikTok calls happen directly from your machine using your tokens

```
Your machine                          Our server
+---------------------------+         +------------------+
| MCP client (Claude, etc.) |         |                  |
|   |                       |         |  Knowledge base  |
|   v                       |  API    |  (insights,      |
| mobile-growth-mcp --------+--key--->|   search,        |
|   |                       |         |   embeddings)    |
|   | Your token            |         +------------------+
|   | stays here            |
|   v                       |
| Meta / Google / TikTok API|
+---------------------------+
```

Your ad platform tokens are used locally and are never sent to our servers.

## What You Get

**Knowledge base tools** — search, browse, and retrieve expert insights on creative strategy, audience targeting, scaling, bid optimization, and more.

**Meta Marketing API tools** — pull campaigns, ad sets, ads, and performance insights directly from your Meta ad account.

**10 pre-built report prompts** — ad fatigue detection, weekly performance, creative health, placement audits, audience composition, architecture reviews, campaign comparisons, attribution analysis, and full account audits.

## Tools

| Tool | Description |
|------|-------------|
| `connection_status` | Check KB and Meta API connection status; shows how to fix issues |
| `search_insights` | Semantic + keyword hybrid search across curated insights |
| `list_insights` | Browse all insights with optional filtering |
| `get_insight` | Full content of a specific insight by slug or ID |
| `get_meta_campaigns` | List campaigns with objectives, budgets, bid strategies |
| `get_meta_adsets` | List ad sets with targeting and optimization goals |
| `get_meta_ads` | List ads with creative info |
| `get_meta_insights` | Performance data with breakdowns, date ranges, levels |
| `get_meta_ad_fatigue` | Built-in creative fatigue detection report |

## Report Prompts

Each prompt takes an `ad_account_id` and walks the LLM through a structured analysis:

| Prompt | Description | API Calls |
|--------|-------------|-----------|
| `ad-fatigue-report` | Detect creative fatigue with daily granularity | 1 |
| `weekly-performance` | Week-over-week health with Kast diagnostic framework | 2 |
| `creative-performance` | Categorize ads: scaling / promising / fatiguing / dead weight | 1 |
| `placement-efficiency` | Identify placement waste and quantify savings | 1/campaign |
| `audience-composition` | Age x gender heatmap with CPA analysis | 1-2 |
| `architecture-review` | Campaign structure evaluation | 3 |
| `audit-meta-account` | Comprehensive account audit | 6+ |
| `campaign-comparison` | Side-by-side campaign comparison | 3+ |
| `placement-audit` | Detailed placement audit with waste quantification | 1/campaign |
| `attribution-analysis` | Conversion quality validation | 2+ |

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
# For Meta tools: set META_ACCESS_TOKEN
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
  src/meta/            — Meta Marketing API client
  src/tools/           — All MCP tools (knowledge base + Meta)
  src/resources/       — MCP resources (vocabulary, instructions)
packages/ingestion/    — CLI to validate & upsert insight JSONs
data/insights/         — Curated insight JSON files
skills/                — Skill markdown files (report methodologies)
supabase/migrations/   — SQL migrations
supabase/functions/    — Edge Functions (embed, search)
```

## License

This project uses a dual license:

- **Code** (everything except `skills/`) — [MIT License](LICENSE)
- **Skill prompts** (`skills/*.md`) — [CC BY-NC-SA 4.0](skills/LICENSE) — you can read, learn from, and adapt them for non-commercial use, but you can't use them to build a competing commercial product

The curated knowledge base is not included in this repository.
