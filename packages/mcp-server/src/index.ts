import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerRemoteTools, registerRemotePrompts } from "./remote-proxy.js";
import { registerGetMetaCampaigns } from "./tools/meta-campaigns.js";
import { registerGetMetaAdSets } from "./tools/meta-adsets.js";
import { registerGetMetaAds } from "./tools/meta-ads.js";
import { registerGetMetaInsights } from "./tools/meta-insights.js";
import { registerGetMetaAdFatigue } from "./tools/meta-ad-fatigue.js";
import { registerVocabularyResource } from "./resources/vocabulary.js";
import { registerInstructionsResource } from "./resources/instructions.js";

const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error(
    "Error: API_KEY environment variable is required.\n" +
      "Get your key from the server admin and add it to your MCP config:\n" +
      '  "env": { "API_KEY": "me_..." }'
  );
  process.exit(1);
}

const server = new McpServer({
  name: "mobile-growth-mcp",
  version: "2.0.0",
});

// Knowledge base tools (proxied through Edge Function)
console.error("Connecting to knowledge base...");
await registerRemoteTools(server, apiKey);

// Meta Marketing API tools (run locally)
registerGetMetaCampaigns(server);
registerGetMetaAdSets(server);
registerGetMetaAds(server);
registerGetMetaInsights(server);
registerGetMetaAdFatigue(server);

// Resources
registerVocabularyResource(server);
registerInstructionsResource(server);

// Prompts (reports & skills, proxied through Edge Function)
await registerRemotePrompts(server, apiKey);

const transport = new StdioServerTransport();
await server.connect(transport);
