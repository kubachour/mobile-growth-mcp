#!/usr/bin/env node
// Smoke test for the deployed mcp Edge Function.
// Verifies KB read path + the three write-side admin/feedback tools.
// Test rows are tagged "[SMOKE-TEST]" so admin can clean up later.
//
// Usage:
//   API_KEY=me_... node scripts/smoke-test.mjs
//   node scripts/smoke-test.mjs --api-key=me_...
//
// Exit codes:
//   0 — all checks passed
//   1 — at least one check failed (details printed)

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const EDGE_FUNCTION_URL =
  process.env.MCP_EDGE_URL ??
  "https://iattgvzqiqrpzoqnrwfr.supabase.co/functions/v1/mcp";

const TAG = "[SMOKE-TEST]";

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
  process.exit(1);
}

let nextId = 1;
async function rpc(apiKey, method, params) {
  const id = nextId++;
  const t0 = Date.now();
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    signal: AbortSignal.timeout(30_000),
  });
  const ms = Date.now() - t0;
  const ct = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} in ${ms}ms — ${text.slice(0, 300)}`);
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

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function step(name, fn) {
  try {
    const detail = await fn();
    check(name, true, detail ?? "");
  } catch (err) {
    check(name, false, err instanceof Error ? err.message : String(err));
  }
}

async function main() {
  const apiKey = loadApiKey();
  console.log(`Smoke testing: ${EDGE_FUNCTION_URL}`);
  console.log(`API key: ${apiKey.slice(0, 6)}…${apiKey.slice(-4)}\n`);

  await step("tools/list returns ≥10 tools incl. search_insights", async () => {
    const { json, ms } = await rpc(apiKey, "tools/list");
    if (json.error) throw new Error(json.error.message);
    const tools = json.result?.tools ?? [];
    const names = tools.map((t) => t.name);
    const required = [
      "search_insights",
      "get_insight",
      "submit_feedback",
      "suggest_insight",
      "suggest_skill",
    ];
    const missing = required.filter((n) => !names.includes(n));
    if (missing.length) throw new Error(`missing tools: ${missing.join(", ")}`);
    if (tools.length < 10) throw new Error(`only ${tools.length} tools listed`);
    return `${tools.length} tools, ${ms}ms`;
  });

  await step("search_insights returns results", async () => {
    const { json, ms } = await rpc(apiKey, "tools/call", {
      name: "search_insights",
      arguments: { query: "creative fatigue subscription apps", limit: 3 },
    });
    if (json.error) throw new Error(json.error.message);
    if (json.result?.isError) {
      const text = json.result.content?.[0]?.text ?? "(no error text)";
      throw new Error(`tool returned isError: ${text.slice(0, 200)}`);
    }
    const text = json.result?.content?.[0]?.text ?? "";
    if (!text || text.includes("No insights found")) {
      throw new Error(`empty result: ${text.slice(0, 100)}`);
    }
    return `${text.length} chars, ${ms}ms`;
  });

  await step("submit_feedback (bug_report) writes a row", async () => {
    const { json, ms } = await rpc(apiKey, "tools/call", {
      name: "submit_feedback",
      arguments: {
        category: "bug_report",
        summary: `${TAG} automated smoke test — ignore. Run at ${new Date().toISOString()}.`,
        search_queries_tried: [`${TAG} dummy`],
      },
    });
    if (json.error) throw new Error(json.error.message);
    if (json.result?.isError) {
      throw new Error(json.result.content?.[0]?.text?.slice(0, 200) ?? "isError");
    }
    return `${ms}ms`;
  });

  await step("suggest_insight writes a pending row", async () => {
    const { json, ms } = await rpc(apiKey, "tools/call", {
      name: "suggest_insight",
      arguments: {
        title: `${TAG} smoke test insight`,
        insight: `${TAG} This is an automated smoke-test row. Safe to delete from suggested_insights where status='pending'.`,
        source_type: "notes",
        confidence: 1,
      },
    });
    if (json.error) throw new Error(json.error.message);
    if (json.result?.isError) {
      throw new Error(json.result.content?.[0]?.text?.slice(0, 200) ?? "isError");
    }
    const text = json.result?.content?.[0]?.text ?? "";
    if (!/Suggestion #\d+/.test(text)) {
      throw new Error(`unexpected response: ${text.slice(0, 200)}`);
    }
    return `${ms}ms — ${text.match(/Suggestion #\d+/)?.[0] ?? "?"}`;
  });

  await step("suggest_skill writes a pending row", async () => {
    const { json, ms } = await rpc(apiKey, "tools/call", {
      name: "suggest_skill",
      arguments: {
        name: "smoke-test-skill",
        description: `${TAG} automated smoke test — safe to delete.`,
        when_to_use: [`${TAG} never trigger`],
        data_sources: ["none"],
        user_description: `${TAG} automated smoke test row. Run at ${new Date().toISOString()}.`,
      },
    });
    if (json.error) throw new Error(json.error.message);
    if (json.result?.isError) {
      throw new Error(json.result.content?.[0]?.text?.slice(0, 200) ?? "isError");
    }
    const text = json.result?.content?.[0]?.text ?? "";
    if (!/Skill suggestion #\d+/.test(text)) {
      throw new Error(`unexpected response: ${text.slice(0, 200)}`);
    }
    return `${ms}ms — ${text.match(/Skill suggestion #\d+/)?.[0] ?? "?"}`;
  });

  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`\n${passed}/${total} checks passed`);
  if (passed < total) {
    console.log(
      "\nCleanup (admin): delete rows tagged [SMOKE-TEST] in feedback, suggested_insights, suggested_skills."
    );
  }
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
