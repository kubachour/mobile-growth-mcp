import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StartupStatus } from "../tools/connection-status.js";

const INSTRUCTIONS = `# Mobile Growth MCP — Knowledge Base for Mobile Growth

## Welcome

You're connected to the Mobile Growth knowledge base: curated, practitioner-tested insights on mobile user acquisition, monetization and subscription app growth. Its two jobs:

1. **Answer from expert knowledge.** Use \`search_insights\` before giving advice or searching the web.
2. **Capture new knowledge.** When the user shares a link, post, podcast, screenshot or thread, extract the insights and save them with \`suggest_insight\` — one call per source.

Ad platform data comes from the platforms' own MCPs:
- **Google Ads:** the official Google Ads MCP (\`googleads/google-ads-mcp\`, read-only GAQL \`search\`). The Google skills here tell you which queries to run. This MCP adds the write side: uploading images and YouTube videos and adding them to App campaign ads.
- **Meta:** Meta's official Meta Ads MCP / AI connector. This MCP ships no Meta tools.

If you can't find what you need, call \`submit_feedback\` to report the gap.

---

## Knowledge Base Tools

### search_insights
Semantic + keyword hybrid search. **Use this first** for any mobile growth question.
- **query** (required), **topics** / **applies_to** (optional filters), **limit** (1-30, default 10)

### get_insight
Full content of one insight by numeric ID or slug (e.g. "ab-pt-010").

### get_vocabulary_counts
How many insights use each topic and applies_to tag.

### submit_feedback ⭐ call PROACTIVELY
Report a KB gap, a tool bug or a missing capability. Call without asking when search returns nothing useful, a tool errors, or you fell back to general knowledge.
- **category**: \`bug_report\`, \`missing_knowledge\`, \`search_quality\`, \`missing_feature\`, \`other\`
- **summary**: specific and anonymized (no account IDs or tokens)

---

## Saving Knowledge

### suggest_insight ⭐ DEFAULT for saving — call PROACTIVELY
**Trigger (don't wait for "save this"):** the user shares a link, article, podcast, LinkedIn/X post, screenshot or thread with mobile-growth advice, pastes raw content, or describes a learning not yet in the KB.

**How:** follow the \`extract-insights\` prompt. Split the source into distinct insights, check each against \`search_insights\`, then save them all in ONE call:
- Shared source fields once at the top level: \`source_type\`, \`source_author\`, \`source_title\`, \`source_date\`, \`platform\`
- \`insights\`: up to 20 items, each with \`title\` + \`insight\` (+ \`topics\`, \`applies_to\`, \`confidence\` 1-5, \`actionable_steps\`, \`raw_excerpt\` under 500 chars)
- A single insight can also be passed directly as \`title\` + \`insight\`

**What happens:** admin keys publish immediately (embedded and searchable at once); likely duplicates stay in the review queue and are listed in the reply. Other keys go to the admin review queue. Admins can pass \`publish=false\` to queue instead.

### save_private_insight
Private to your API key and searchable at once. **Only** for client-specific data (account metrics, internal benchmarks) or when the user asks for private storage.

### suggest_skill
Propose a repeatable workflow. Draft the full skill .md first ("## What It Does", "## When to Use This", "## What It Needs", "## Procedure", "## Output") and pass it as content_md. Goes to admin review.

### Admin tools (admin keys only)
\`review_suggestions\`, \`approve_suggestion\`, \`reject_suggestion\`, \`review_skill_suggestions\`, \`approve_skill_suggestion\`, \`reject_skill_suggestion\`, \`list_insights\`, \`delete_insight\`, \`suggest_improvement\`. Approving embeds the insight and reports similar existing ones.

---

## Google Ads Upload Tools (run locally)

Need Google Ads credentials in this MCP: run \`npx mobile-growth-mcp auth google\` once. Reading data does NOT need them — use the official Google Ads MCP for that. **Always run with \`dry_run=true\` first and show the user the plan.**

### upload_google_image_assets
Upload images (URLs or local files, up to 50) as image assets. With \`ad_group_id\`, also adds them to that App campaign ad group's ad (keeps the existing images; max 20 per ad).

### upload_google_video_assets
Google Ads can't take video files: the video must be on YouTube (public or unlisted). Pass YouTube IDs or URLs (up to 50). Existing assets for the same video are reused, not duplicated. With \`ad_group_id\`, also adds them to the ad (max 20 videos).

### add_assets_to_app_ad
Add existing image/video assets and new headlines (≤30 chars, max 5) or descriptions (≤90 chars, max 5) to an App campaign ad group's ad. Reads the ad first and appends, because Google replaces the whole list on update. Never removes anything.

---

## Skills (MCP Prompts)

| Prompt | What it does |
|--------|-------------|
| extract-insights | Turn a source into insights and save them in one call |
| google-account-audit | Full Google App Campaigns audit against the KB (signal, windows, tROAS, exclusions, audience signals, assets, network, iOS ODM/ICM) |
| google-campaign-health | Week-over-week health and algorithm thresholds |
| google-asset-performance | Asset health by CPI, gaps, refresh plan |
| google-network-audit | Spend and CPI by network, traffic shifts, placements |
| google-architecture-review | Campaign and ad group structure, exclusions, signals |
| google-bid-strategy | Bid strategy, conversion window vs tROAS target, safe change sequences |
| admin-briefing | Admin: pending suggestions, bugs, knowledge gaps |

Each Google skill lists the GAQL queries to run through the Google Ads MCP, with a CSV fallback.

---

## Presenting Results

- Say the information comes from the Mobile Growth knowledge base, and cite author + slug for key claims (e.g. "(Ashley Black, \`ab-pt-010\`)").
- When several insights agree, say how many. When they conflict, say so instead of picking one silently.
- Keep KB-sourced advice separate from your own reasoning.
- If a tool errors unexpectedly, call \`submit_feedback\` with category \`bug_report\`.
`;

function buildStatusSection(status?: StartupStatus): string {
  if (!status) return "";

  const lines: string[] = ["\n## Connection Status\n"];

  if (status.kb.connected) {
    lines.push(
      `- **Knowledge Base**: Connected (${status.kb.toolCount} tools, ${status.kb.promptCount} prompts)`
    );
  } else {
    lines.push(
      `- **Knowledge Base**: Not connected — ${status.kb.error ?? "API_KEY not configured"}`
    );
    lines.push(
      "  - Fix: provide your API key via `--api-key=me_...` CLI arg, `API_KEY` env var, or `.env` file"
    );
  }

  lines.push(
    "- **Reading ad data**: use the official Google Ads MCP and Meta's official connector — this MCP ships no read tools for ad platforms"
  );

  if (status.google.configured) {
    lines.push("- **Google Ads uploads**: Configured");
  } else {
    lines.push(
      "- **Google Ads uploads**: Not connected (optional — only needed to upload images/videos)"
    );
    lines.push(
      "  - To connect: run `npx mobile-growth-mcp auth google` to set up credentials"
    );
  }

  return lines.join("\n");
}

export function registerInstructionsResource(
  server: McpServer,
  status?: StartupStatus
): void {
  const text = INSTRUCTIONS + buildStatusSection(status);

  server.resource(
    "instructions",
    "instructions://getting-started",
    {
      description:
        "Getting started guide: knowledge base search, saving insights, Google Ads upload tools and skills. Read this first.",
      mimeType: "text/plain",
    },
    async () => ({
      contents: [
        {
          uri: "instructions://getting-started",
          mimeType: "text/plain",
          text,
        },
      ],
    })
  );
}
