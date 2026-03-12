# mobile-growth-mcp

[![npm](https://img.shields.io/npm/v/mobile-growth-mcp)](https://www.npmjs.com/package/mobile-growth-mcp)

MCP server for mobile growth & user acquisition. Connect your LLM to a curated knowledge base of ad optimization insights + live Meta Marketing API access. Focused on subscription apps. More networks coming.

## Quick Start

Add this to your MCP client config:

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

That's it. Get your API key from your account admin.

> **Optional**: Add `"--meta-token=YOUR_META_TOKEN"` to the args array to enable live Meta campaign data.

### Where to put this config

| Client | Config file path |
|--------|-----------------|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%\Claude\claude_desktop_config.json` |
| Claude Code | `.mcp.json` in your project root |
| Cursor | `.cursor/mcp.json` |
| Codex | MCP config in your Codex setup |

### Alternative: env block

If your client supports `env`, you can use that instead of CLI args:

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

### Alternative: `.env` file

Create a `.env` file in your working directory:

```
API_KEY=me_YOUR_KEY
META_ACCESS_TOKEN=your-meta-access-token
```

### No API key?

The server still starts — you get Meta tools and a `connection_status` tool that explains what's missing and how to fix it.

## What You Get

**Knowledge base tools** — search, browse, and retrieve expert insights on creative strategy, audience targeting, scaling, bid optimization, and more.

**Meta Marketing API tools** — pull campaigns, ad sets, ads, and performance insights directly from your Meta ad account. Your access token never leaves your machine.

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
