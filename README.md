# Growth Mobile MCP

A curated knowledge base of mobile advertising and growth insights + direct Meta Marketing API integration, served via MCP (Model Context Protocol). Connect your LLM — Claude Desktop, Cursor, Claude Code, or any MCP client — and query expert-sourced insights on campaign optimization, creative strategy, audience targeting, and more. Focused on subscription apps and user acquisition across Meta, Google, and TikTok.

## Connect to Your LLM

You need:
- `API_KEY` — provided by the server admin (generated with `./scripts/generate-api-key.sh`)
- `META_ACCESS_TOKEN` — (optional) your Meta Marketing API access token for live campaign data

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "growth-mobile": {
      "command": "npx",
      "args": ["-y", "mobile-growth-mcp"],
      "env": {
        "API_KEY": "me_your-api-key",
        "META_ACCESS_TOKEN": "paste-your-meta-token-here"
      }
    }
  }
}
```

### Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "growth-mobile": {
      "command": "npx",
      "args": ["-y", "mobile-growth-mcp"],
      "env": {
        "API_KEY": "me_your-api-key",
        "META_ACCESS_TOKEN": "paste-your-meta-token-here"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "growth-mobile": {
      "command": "npx",
      "args": ["-y", "mobile-growth-mcp"],
      "env": {
        "API_KEY": "me_your-api-key",
        "META_ACCESS_TOKEN": "paste-your-meta-token-here"
      }
    }
  }
}
```

### OpenAI Codex

Codex reads `AGENTS.md` automatically. For MCP, add to your Codex config:

```json
{
  "mcpServers": {
    "growth-mobile": {
      "command": "npx",
      "args": ["-y", "mobile-growth-mcp"],
      "env": {
        "API_KEY": "me_your-api-key",
        "META_ACCESS_TOKEN": "paste-your-meta-token-here"
      }
    }
  }
}
```

## Knowledge Base Tools

### `search_insights`

Semantic + keyword hybrid search across the knowledge base.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | yes | Natural language search query |
| `topics` | string[] | no | Filter by topic tags |
| `applies_to` | string[] | no | Filter by applicability |
| `limit` | number | no | Max results (1-30, default 10) |

### `list_insights`

Browse all insights with optional filtering. Returns titles and metadata.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `topic` | string | no | Filter by a single topic tag |
| `applies_to` | string | no | Filter by a single applies_to value |

### `get_insight`

Fetch full content of a specific insight by ID or slug.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | number \| string | yes | Numeric ID or string slug |

## Meta Marketing API Tools

Requires `META_ACCESS_TOKEN`. Without it, these tools return a clear error — knowledge base tools work with just `API_KEY`.

All Meta tools default to **last 7 days**, **active campaigns only**, and **minimal field sets** to avoid rate limits.

### `get_meta_campaigns`

List campaigns from a Meta ad account.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ad_account_id` | string | yes | e.g. "act_123456789" |
| `fields` | string | no | Comma-separated fields |
| `effective_status` | string[] | no | Default: ["ACTIVE"] |
| `limit` | number | no | Results per page (default 50) |
| `after` | string | no | Pagination cursor |

### `get_meta_adsets`

List ad sets, optionally scoped to a campaign.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ad_account_id` | string | yes | e.g. "act_123456789" |
| `campaign_id` | string | no | Scope to specific campaign |
| `fields` | string | no | Comma-separated fields |
| `effective_status` | string[] | no | Default: ["ACTIVE"] |
| `limit` | number | no | Results per page (default 50) |
| `after` | string | no | Pagination cursor |

### `get_meta_ads`

List ads, optionally scoped to an ad set.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ad_account_id` | string | yes | e.g. "act_123456789" |
| `adset_id` | string | no | Scope to specific ad set |
| `fields` | string | no | Comma-separated fields |
| `effective_status` | string[] | no | Default: ["ACTIVE"] |
| `limit` | number | no | Results per page (default 50) |
| `after` | string | no | Pagination cursor |

### `get_meta_insights`

Pull performance insights with configurable breakdowns, levels, and date ranges.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ad_account_id` | string | yes | e.g. "act_123456789" |
| `level` | string | no | account/campaign/adset/ad (default: campaign) |
| `fields` | string | no | Comma-separated fields |
| `date_preset` | string | no | Default: last_7d |
| `time_range` | object | no | {since, until} for custom dates |
| `time_increment` | string | no | "1" for daily, "7" for weekly |
| `breakdowns` | string | no | e.g. "age,gender" |
| `conversion_event` | string | no | Default: mobile_app_install |
| `filtering` | string | no | JSON filtering array |
| `sort` | string | no | e.g. "spend_descending" |
| `limit` | number | no | Results per page (default 50) |
| `after` | string | no | Pagination cursor |

### `get_meta_ad_fatigue`

Built-in report: detect creative fatigue via frequency, CTR decline, and CPA trends.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ad_account_id` | string | yes | e.g. "act_123456789" |
| `campaign_id` | string | no | Scope to specific campaign |
| `conversion_event` | string | no | Default: mobile_app_install |
| `frequency_warning` | number | no | Warning threshold (default 3) |
| `frequency_critical` | number | no | Critical threshold (default 5) |
| `ctr_decline_threshold` | number | no | CTR decline % (default 30) |

## Reports (MCP Prompts)

Pre-built analysis workflows. Select a prompt and provide your `ad_account_id`:

| Prompt | Description | API Calls |
|--------|-------------|-----------|
| `ad-fatigue-report` | Detect creative fatigue with daily granularity | 1 |
| `weekly-performance` | Week-over-week health with Kast diagnostic framework | 2 |
| `creative-performance` | Categorize ads: scaling, promising, contributing, fatiguing, dead weight | 1 |
| `placement-efficiency` | Identify placement waste and quantify savings | 1/campaign |
| `audience-composition` | Age × gender heatmap with CPA analysis | 1-2 |
| `architecture-review` | Campaign structure evaluation (no insights needed) | 3 |
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
git clone <repo-url> && cd meta-editor
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
npm publish
```

### Project Structure

```
packages/shared/       — Types, Supabase client
packages/mcp-server/   — MCP server (published as mobile-growth-mcp)
  src/meta/            — Meta Marketing API client
  src/tools/           — All MCP tools (knowledge base + Meta)
  src/prompts/         — MCP prompt registrations (reports)
  src/resources/       — MCP resources (vocabulary, instructions)
packages/ingestion/    — CLI to validate & upsert insight JSONs
data/insights/         — Curated insight JSON files
skills/                — Skill markdown files (report methodologies)
supabase/migrations/   — SQL migrations
supabase/functions/    — Edge Functions (embed, search)
mcp-configs/           — Ready-to-copy MCP client configs
.cursor/rules/         — Cursor AI rules (project context, tools, reports)
AGENTS.md              — OpenAI Codex agent instructions
CLAUDE.md              — Claude Code project instructions
```
