# mobile-growth-mcp

MCP server for mobile growth & user acquisition: a curated knowledge base of practitioner-tested insights, with one-call capture of new learnings from links, posts and podcasts, plus KB-grounded audit skills for Google App Campaigns. Focused on subscription apps.

Ad data is read through the platforms' **official** MCPs: the [Google Ads MCP](https://github.com/googleads/google-ads-mcp) for Google, Meta's Meta Ads MCP / AI connector for Meta. This MCP adds the Google write side: uploading images and YouTube videos and adding them to App campaign ads.

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

## License

MIT
