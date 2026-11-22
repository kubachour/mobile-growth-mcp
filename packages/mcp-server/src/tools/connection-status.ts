import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

declare const __PKG_VERSION__: string;
// Fallback for non-bundled execution (e.g. ts-node / dev) where the
// tsup `define` substitution doesn't run.
export const SERVER_VERSION =
  typeof __PKG_VERSION__ !== "undefined" ? __PKG_VERSION__ : "dev";

export interface StartupStatus {
  kb: {
    connected: boolean;
    toolCount: number;
    promptCount: number;
    error?: string;
  };
  google: {
    configured: boolean;
    missing: string[];
  };
  apiKey: {
    source: string;
  };
}

export function registerConnectionStatus(
  server: McpServer,
  status: StartupStatus
): void {
  server.tool(
    "connection_status",
    "Check the connection status of the knowledge base and the Google Ads upload tools. Call this if tools seem missing or you get unexpected errors.",
    {},
    async () => {
      const lines: string[] = [
        "# Connection Status",
        "",
        `**Server version:** mobile-growth-mcp@${SERVER_VERSION}`,
        "",
      ];

      // KB status
      if (status.kb.connected) {
        lines.push(
          `## Knowledge Base: Connected`,
          `- ${status.kb.toolCount} KB tools loaded`,
          `- ${status.kb.promptCount} prompts loaded`,
          `- API key source: ${status.apiKey.source}`
        );
      } else {
        lines.push(
          `## Knowledge Base: Not Connected`,
          `- Reason: ${status.kb.error ?? "API_KEY not configured"}`,
          "",
          "### How to fix",
          "Provide your API key using one of these methods (in priority order):",
          "1. CLI argument: add `--api-key=me_...` to the args array in your MCP config",
          '2. Environment variable: add `"API_KEY": "me_..."` to the env block in your MCP config',
          "3. `.env` file: create a `.env` file in your working directory with `API_KEY=me_...`"
        );
      }

      lines.push("");

      // Meta data note
      lines.push(
        "## Reading Ad Data: Use the Platforms' Official MCPs",
        "- Google Ads: the official Google Ads MCP (googleads/google-ads-mcp, read-only GAQL). The Google skills here list the queries to run.",
        "- Meta: Meta's official Meta Ads MCP / AI connector. This MCP ships no Meta tools."
      );

      lines.push("");

      // Google Ads status
      if (status.google.configured) {
        lines.push(
          "## Google Ads Uploads: Configured",
          "- upload_google_image_assets, upload_google_video_assets and add_assets_to_app_ad are ready (use dry_run first)"
        );
      } else {
        lines.push(
          "## Google Ads Uploads: Not Connected (Optional)",
          "- Only needed to upload images/videos and add them to App campaign ads",
          "- KB search, saving insights and the Google skills (via the official Google Ads MCP) work without it",
          "",
          "### How to connect",
          "Option 1 — Interactive setup (recommended):",
          "```",
          "npx mobile-growth-mcp auth google",
          "```",
          "This walks you through developer token, OAuth credentials, and authorization. Saves to `.env`.",
          "",
          'Option 2 — Add credentials manually to the `"env"` block in your MCP config:',
          "- `GOOGLE_ADS_DEVELOPER_TOKEN`",
          "- `GOOGLE_ADS_CLIENT_ID`",
          "- `GOOGLE_ADS_CLIENT_SECRET`",
          "- `GOOGLE_ADS_REFRESH_TOKEN`",
          "- `GOOGLE_ADS_LOGIN_CUSTOMER_ID` (optional, for MCC accounts)",
          "",
          "Then restart your MCP client."
        );
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}
