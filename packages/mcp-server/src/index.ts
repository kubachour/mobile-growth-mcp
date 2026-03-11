import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  fetchRemoteTools,
  registerFetchedTools,
  fetchRemotePrompts,
  registerFetchedPrompts,
} from "./remote-proxy.js";
import { registerGetMetaCampaigns } from "./tools/meta-campaigns.js";
import { registerGetMetaAdSets } from "./tools/meta-adsets.js";
import { registerGetMetaAds } from "./tools/meta-ads.js";
import { registerGetMetaInsights } from "./tools/meta-insights.js";
import { registerGetMetaAdFatigue } from "./tools/meta-ad-fatigue.js";
import {
  registerConnectionStatus,
  type StartupStatus,
} from "./tools/connection-status.js";
import { registerVocabularyResource } from "./resources/vocabulary.js";
import { registerInstructionsResource } from "./resources/instructions.js";
import { resolveApiKey, resolveMetaToken } from "./config.js";

// ── Resolve configuration ──────────────────────────────────────────

const apiKeyResult = resolveApiKey();
const metaTokenResult = resolveMetaToken();

// Set env vars so downstream code (e.g. vocabulary.ts) can read them
if (apiKeyResult.value) process.env.API_KEY = apiKeyResult.value;
if (metaTokenResult.value) process.env.META_ACCESS_TOKEN = metaTokenResult.value;

const apiKey = apiKeyResult.value;
console.error(
  apiKey
    ? `API key: ${apiKeyResult.source}`
    : "API key: not configured — KB tools will not be available"
);
console.error(
  metaTokenResult.value
    ? `Meta token: ${metaTokenResult.source}`
    : "Meta token: not configured — Meta tools will return errors when called"
);

// ── Create server ──────────────────────────────────────────────────

const server = new McpServer({
  name: "mobile-growth-mcp",
  version: "2.0.0",
});

// ── Track startup status ───────────────────────────────────────────

const status: StartupStatus = {
  kb: { connected: false, toolCount: 0, promptCount: 0 },
  meta: { tokenConfigured: !!metaTokenResult.value },
  apiKey: { source: apiKeyResult.source },
};

// ── Knowledge base tools (proxied through Edge Function) ───────────

if (apiKey) {
  console.error("Connecting to knowledge base...");
  try {
    const tools = await fetchRemoteTools(apiKey);
    registerFetchedTools(server, apiKey, tools);
    status.kb.toolCount = tools.length;
    status.kb.connected = true;
    console.error(`KB connected: ${tools.length} tools loaded`);
  } catch (err) {
    const msg = (err as Error).message;
    status.kb.error = msg;
    console.error(`KB tools failed: ${msg}`);
  }
} else {
  status.kb.error = "API_KEY not configured";
}

// ── Meta Marketing API tools (run locally) ─────────────────────────

registerGetMetaCampaigns(server);
registerGetMetaAdSets(server);
registerGetMetaAds(server);
registerGetMetaInsights(server);
registerGetMetaAdFatigue(server);

// ── Connection status tool (always present) ────────────────────────

registerConnectionStatus(server, status);

// ── Resources ──────────────────────────────────────────────────────

registerVocabularyResource(server);
registerInstructionsResource(server, status);

// ── Prompts (reports & skills, proxied through Edge Function) ──────

if (apiKey) {
  try {
    const prompts = await fetchRemotePrompts(apiKey);
    registerFetchedPrompts(server, apiKey, prompts);
    status.kb.promptCount = prompts.length;
    console.error(`KB prompts: ${prompts.length} loaded`);
  } catch (err) {
    console.error(
      `KB prompts failed: ${(err as Error).message}`
    );
  }
}

// ── Start transport ────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
