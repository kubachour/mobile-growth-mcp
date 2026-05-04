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
    "Check the connection status of the knowledge base and Google Ads API. Call this if tools seem missing or you get unexpected errors.",
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
        "## Meta Ads Data: Use Meta's Official AI Connector",
        "- This MCP no longer ships Meta API tools (avoids unofficial-API risk).",
        "- For Meta data, install Meta's official Meta Ads MCP / AI connector and let the analytical skills here interpret what it returns."
      );

      lines.push("");

      // Google Ads status
      if (status.google.configured) {
        lines.push(
          "## Google Ads API: Configured",
          "- Google Ads tools are available and ready to use"
        );
      } else {
        lines.push(
          "## Google Ads API: Not Connected (Optional)",
          "- KB, suggestions, and private insights work without it",
          "- Connect Google Ads to unlock campaign data and network analysis",
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
