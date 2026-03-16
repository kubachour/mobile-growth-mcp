import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface StartupStatus {
  kb: {
    connected: boolean;
    toolCount: number;
    promptCount: number;
    error?: string;
  };
  meta: {
    tokenConfigured: boolean;
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
    "Check the connection status of the knowledge base and Meta API. Call this if tools seem missing or you get unexpected errors.",
    {},
    async () => {
      const lines: string[] = ["# Connection Status", ""];

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

      // Meta status
      if (status.meta.tokenConfigured) {
        lines.push(
          "## Meta Marketing API: Configured",
          "- Meta tools are available and ready to use"
        );
      } else {
        lines.push(
          "## Meta Marketing API: Not Configured",
          "- Meta tools will return an error when called",
          "",
          "### How to fix",
          "Provide your Meta access token using one of these methods:",
          '1. MCP config: add `"META_ACCESS_TOKEN": "..."` to the `"env"` block in `.mcp.json` (Claude Code/Cursor) or `claude_desktop_config.json` (Claude Desktop)',
          "2. CLI argument: add `--meta-token=...` to the args array",
          "3. `.env` file: add `META_ACCESS_TOKEN=...` to a `.env` file in your working directory",
          "",
          "Then restart your MCP client."
        );
      }

      lines.push("");

      // Google Ads status
      if (status.google.configured) {
        lines.push(
          "## Google Ads API: Configured",
          "- Google Ads tools are available and ready to use"
        );
      } else {
        lines.push(
          "## Google Ads API: Not Configured",
          "- Google Ads tools will return an error when called",
          `- Missing: ${status.google.missing.join(", ")}`,
          "",
          "### How to fix",
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
