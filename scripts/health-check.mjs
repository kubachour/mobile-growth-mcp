#!/usr/bin/env node
// Lightweight health-check for the deployed mcp Edge Function.
// Read-only: exercises the OpenAI embedding path via search_insights so a
// quota/billing lapse (429) or outage is caught early — WITHOUT writing any
// rows. For the full write-side suite (feedback/suggest tools) use smoke-test.
//
// Usage:
//   API_KEY=me_... node scripts/health-check.mjs
//   node scripts/health-check.mjs --api-key=me_...
//
// Exit codes:
//   0 — embedding/search path healthy
//   1 — degraded (search failed; likely OpenAI quota/billing or outage)
//   2 — unreachable / misconfigured (network, auth, bad endpoint)

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const EDGE_FUNCTION_URL =
  process.env.MCP_EDGE_URL ??
  "https://iattgvzqiqrpzoqnrwfr.supabase.co/functions/v1/mcp";

function loadApiKey() {
  const fromArg = process.argv
    .find((a) => a.startsWith("--api-key="))
    ?.slice("--api-key=".length);
  if (fromArg) return fromArg;
  if (process.env.API_KEY) return process.env.API_KEY;

  const envPath = resolve(process.cwd(), ".env");
  if (existsSync(envPath)) {
    const m = readFileSync(envPath, "utf8").match(/^API_KEY=(.+)$/m);
    if (m) return m[1].replace(/^["']|["']$/g, "").trim();
  }
  console.error(
    "✗ No API_KEY found. Pass --api-key=me_... or set API_KEY in env / .env."
  );
  process.exit(2);
}

async function rpc(apiKey, method, params) {
  const t0 = Date.now();
  let res;
  try {
    res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    // Network error / timeout — endpoint unreachable.
    const e = new Error(err?.message ?? String(err));
    e.unreachable = true;
    throw e;
  }
  const ms = Date.now() - t0;
  const ct = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    const text = await res.text();
    const e = new Error(`HTTP ${res.status} in ${ms}ms — ${text.slice(0, 200)}`);
    // 401/403 = auth/config problem, not a service degradation.
    if (res.status === 401 || res.status === 403) e.unreachable = true;
    throw e;
  }
  let json;
  if (ct.includes("text/event-stream")) {
    const text = await res.text();
    const m = text.match(/^data:\s*(.+)$/m);
    if (!m) throw new Error(`SSE response had no data line: ${text.slice(0, 200)}`);
    json = JSON.parse(m[1]);
  } else {
    json = await res.json();
  }
  return { json, ms };
}

async function main() {
  const apiKey = loadApiKey();
  console.log(`Health check: ${EDGE_FUNCTION_URL}`);
  console.log(`API key: ${apiKey.slice(0, 6)}…${apiKey.slice(-4)}\n`);

  let json, ms;
  try {
    ({ json, ms } = await rpc(apiKey, "tools/call", {
      name: "search_insights",
      arguments: { query: "creative fatigue subscription apps", limit: 1 },
    }));
  } catch (err) {
    if (err.unreachable) {
      console.error(`✗ UNREACHABLE — ${err.message}`);
      console.error("  Endpoint, network, or API key is misconfigured.");
      process.exit(2);
    }
    console.error(`✗ DEGRADED — ${err.message}`);
    process.exit(1);
  }

  // JSON-RPC transport-level error.
  if (json.error) {
    console.error(`✗ DEGRADED — RPC error: ${json.error.message}`);
    process.exit(1);
  }

  // Tool-level error — this is where an embedding 429 surfaces.
  if (json.result?.isError) {
    const text = json.result.content?.[0]?.text ?? "(no error text)";
    const is429 = /\b429\b|quota|billing|exceeded/i.test(text);
    console.error(`✗ DEGRADED — search_insights failed: ${text.slice(0, 240)}`);
    if (is429) {
      console.error(
        "\n  → Looks like OpenAI quota/billing. The embedding key may be out of credits.\n" +
          "    Fund the org at https://platform.openai.com/settings/organization/billing/overview"
      );
    }
    process.exit(1);
  }

  const text = json.result?.content?.[0]?.text ?? "";
  if (!text || text.includes("No insights found")) {
    console.error(`✗ DEGRADED — empty search result: ${text.slice(0, 120)}`);
    process.exit(1);
  }

  console.log(`✓ HEALTHY — embedding + search path OK (${text.length} chars, ${ms}ms)`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Health check crashed:", err);
  process.exit(2);
});
