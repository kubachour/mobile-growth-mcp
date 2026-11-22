# mobile-growth-mcp

[![npm](https://img.shields.io/npm/v/mobile-growth-mcp)](https://www.npmjs.com/package/mobile-growth-mcp)

MCP server for mobile growth & user acquisition: a curated knowledge base of practitioner-tested insights, with one-call capture of new learnings from links, posts and podcasts, plus KB-grounded audit skills for Google App Campaigns. Focused on subscription apps.

Ad data is read through the platforms' **official** MCPs: the [Google Ads MCP](https://github.com/googleads/google-ads-mcp) for Google, Meta's Meta Ads MCP / AI connector for Meta. This MCP adds the Google write side: uploading images and YouTube videos and adding them to App campaign ads.

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

## Tools

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

## Skills (MCP Prompts)

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
