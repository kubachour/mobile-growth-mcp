import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerSearchInsights } from "./tools/search-insights.js";
import { registerListInsights } from "./tools/list-insights.js";
import { registerGetInsight } from "./tools/get-insight.js";
import { registerGetMetaCampaigns } from "./tools/meta-campaigns.js";
import { registerGetMetaAdSets } from "./tools/meta-adsets.js";
import { registerGetMetaAds } from "./tools/meta-ads.js";
import { registerGetMetaInsights } from "./tools/meta-insights.js";
import { registerGetMetaAdFatigue } from "./tools/meta-ad-fatigue.js";
import { registerVocabularyResource } from "./resources/vocabulary.js";
import { registerInstructionsResource } from "./resources/instructions.js";
import { registerPrompts } from "./prompts/register.js";

const server = new McpServer({
  name: "mobile-growth-mcp",
  version: "1.1.0",
});

// Knowledge base tools
registerSearchInsights(server);
registerListInsights(server);
registerGetInsight(server);

// Meta Marketing API tools
registerGetMetaCampaigns(server);
registerGetMetaAdSets(server);
registerGetMetaAds(server);
registerGetMetaInsights(server);
registerGetMetaAdFatigue(server);

// Resources
registerVocabularyResource(server);
registerInstructionsResource(server);

// Prompts (reports & skills)
registerPrompts(server);

const transport = new StdioServerTransport();
await server.connect(transport);
