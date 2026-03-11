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
          "1. CLI argument: add `--meta-token=...` to the args array",
          '2. Environment variable: add `"META_ACCESS_TOKEN": "..."` to the env block',
          "3. `.env` file: add `META_ACCESS_TOKEN=...` to your `.env` file"
        );
      }

      return {
        content: [{ type: "text" as const, text: lines.join("\n") }],
      };
    }
  );
}
