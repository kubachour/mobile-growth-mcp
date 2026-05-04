import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  fetchRemoteTools,
  registerFetchedTools,
  fetchRemotePrompts,
  registerFetchedPrompts,
} from "./remote-proxy.js";
import { registerGetGoogleAdsCampaigns } from "./tools/google-campaigns.js";
import { registerGetGoogleAdsAdGroups } from "./tools/google-ad-groups.js";
import { registerGetGoogleAdsAssets } from "./tools/google-assets.js";
import { registerGetGoogleAdsInsights } from "./tools/google-insights.js";
import { registerGetGoogleAdsNetworkMix } from "./tools/google-network-mix.js";
import { registerGetGoogleAdsAssetFatigue } from "./tools/google-asset-fatigue.js";
import { registerUploadGoogleImageAssets } from "./tools/google-upload-assets.js";
import {
  registerConnectionStatus,
  SERVER_VERSION,
  type StartupStatus,
} from "./tools/connection-status.js";
import { registerVocabularyResource } from "./resources/vocabulary.js";
import { registerInstructionsResource } from "./resources/instructions.js";
import { resolveApiKey, resolveGoogleAdsConfig } from "./config.js";
import { maybeRunAuthCommand } from "./google/auth.js";

// ── Handle auth subcommands (exits process if matched) ─────────────

await maybeRunAuthCommand();

// ── Resolve configuration ──────────────────────────────────────────

const apiKeyResult = resolveApiKey();
const googleAdsResult = resolveGoogleAdsConfig();

// Set env vars so downstream code can read them
if (apiKeyResult.value) process.env.API_KEY = apiKeyResult.value;
if (googleAdsResult.developerToken)
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN = googleAdsResult.developerToken;
if (googleAdsResult.clientId)
  process.env.GOOGLE_ADS_CLIENT_ID = googleAdsResult.clientId;
if (googleAdsResult.clientSecret)
  process.env.GOOGLE_ADS_CLIENT_SECRET = googleAdsResult.clientSecret;
if (googleAdsResult.refreshToken)
  process.env.GOOGLE_ADS_REFRESH_TOKEN = googleAdsResult.refreshToken;
if (googleAdsResult.loginCustomerId)
  process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID = googleAdsResult.loginCustomerId;

console.error(`mobile-growth-mcp@${SERVER_VERSION} starting`);

const apiKey = apiKeyResult.value;
console.error(
  apiKey
    ? `API key: ${apiKeyResult.source}`
    : "API key: not configured — KB tools will not be available"
);
console.error(
  googleAdsResult.configured
    ? `Google Ads: configured`
    : `Google Ads: not configured (optional — KB works without it). Run \`npx mobile-growth-mcp auth google\` to set up`
);

// ── Create server ──────────────────────────────────────────────────

const server = new McpServer({
  name: "mobile-growth-mcp",
  version: SERVER_VERSION,
});

// ── Track startup status ───────────────────────────────────────────

const status: StartupStatus = {
  kb: { connected: false, toolCount: 0, promptCount: 0 },
  google: {
    configured: googleAdsResult.configured,
    missing: googleAdsResult.missing,
  },
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

// ── Google Ads tools (run locally) ───────────────────────────────

registerGetGoogleAdsCampaigns(server);
registerGetGoogleAdsAdGroups(server);
registerGetGoogleAdsAssets(server);
registerGetGoogleAdsInsights(server);
registerGetGoogleAdsNetworkMix(server);
registerGetGoogleAdsAssetFatigue(server);
registerUploadGoogleImageAssets(server);

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
