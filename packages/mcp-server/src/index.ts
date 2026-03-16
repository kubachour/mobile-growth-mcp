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
import { registerGetGoogleAdsCampaigns } from "./tools/google-campaigns.js";
import {
  registerConnectionStatus,
  type StartupStatus,
} from "./tools/connection-status.js";
import { registerVocabularyResource } from "./resources/vocabulary.js";
import { registerInstructionsResource } from "./resources/instructions.js";
import { resolveApiKey, resolveMetaToken, resolveGoogleAdsConfig } from "./config.js";
import { maybeRunAuthCommand } from "./google/auth.js";

// ── Handle auth subcommands (exits process if matched) ─────────────

await maybeRunAuthCommand();

// ── Resolve configuration ──────────────────────────────────────────

const apiKeyResult = resolveApiKey();
const metaTokenResult = resolveMetaToken();
const googleAdsResult = resolveGoogleAdsConfig();

// Set env vars so downstream code can read them
if (apiKeyResult.value) process.env.API_KEY = apiKeyResult.value;
if (metaTokenResult.value) process.env.META_ACCESS_TOKEN = metaTokenResult.value;
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
console.error(
  googleAdsResult.configured
    ? `Google Ads: configured`
    : `Google Ads: not configured (missing: ${googleAdsResult.missing.join(", ")}) — run \`npx mobile-growth-mcp auth google\` to set up`
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

// ── Meta Marketing API tools (run locally) ─────────────────────────

registerGetMetaCampaigns(server);
registerGetMetaAdSets(server);
registerGetMetaAds(server);
registerGetMetaInsights(server);
registerGetMetaAdFatigue(server);

// ── Google Ads tools (run locally) ───────────────────────────────

registerGetGoogleAdsCampaigns(server);

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
