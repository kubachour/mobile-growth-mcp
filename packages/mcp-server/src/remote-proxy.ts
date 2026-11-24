import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const EDGE_FUNCTION_URL =
  "https://iattgvzqiqrpzoqnrwfr.supabase.co/functions/v1/mcp";

let nextRequestId = 1;

interface RemoteTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

interface RemotePromptArg {
  name: string;
  description: string;
  required: boolean;
}

interface RemotePrompt {
  name: string;
  description: string;
  arguments: RemotePromptArg[];
}

interface RemotePromptMessage {
  role: string;
  content: { type: string; text: string };
}

interface JsonRpcResponse {
  jsonrpc: string;
  id: number;
  result?: {
    tools?: RemoteTool[];
    content?: { type: string; text: string }[];
    isError?: boolean;
    prompts?: RemotePrompt[];
    messages?: RemotePromptMessage[];
  };
  error?: { code: number; message: string };
}

async function jsonRpcRequest(
  apiKey: string,
  method: string,
  params?: Record<string, unknown>
): Promise<JsonRpcResponse> {
  const id = nextRequestId++;
  const body: Record<string, unknown> = {
    jsonrpc: "2.0",
    method,
    id,
  };
  if (params) body.params = params;

  const toolName = (params?.name as string | undefined) ?? "";
  const label = toolName ? `${method}:${toolName}` : method;
  const t0 = Date.now();
  console.error(`[proxy] → #${id} ${label} start`);

  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    const headersMs = Date.now() - t0;

    if (!res.ok) {
      const text = await res.text();
      console.error(
        `[proxy] ✗ #${id} ${label} http ${res.status} after ${headersMs}ms`
      );
      throw new Error(`Edge Function error (${res.status}): ${text}`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    let json: JsonRpcResponse;
    if (contentType.includes("text/event-stream")) {
      // MCP Streamable HTTP: server responded with a single SSE event
      // containing the JSON-RPC response. Read the stream, parse the
      // first `data:` line.
      const text = await res.text();
      const match = text.match(/^data:\s*(.+)$/m);
      if (!match) {
        throw new Error(`SSE response had no data line: ${text.slice(0, 200)}`);
      }
      json = JSON.parse(match[1]) as JsonRpcResponse;
    } else {
      json = (await res.json()) as JsonRpcResponse;
    }
    console.error(
      `[proxy] ← #${id} ${label} ok in ${Date.now() - t0}ms (headers ${headersMs}ms, ct=${contentType.split(";")[0] || "?"})`
    );
    return json;
  } catch (err) {
    const e = err as Error;
    console.error(
      `[proxy] ✗ #${id} ${label} ${e.name}: ${e.message} after ${Date.now() - t0}ms`
    );
    throw err;
  }
}

/**
 * Wraps `jsonRpcRequest` with retry on transient transport failures
 * (AbortError / TimeoutError / network errors). Used by every remote
 * call so a single Edge Function cold start never produces a hard fail.
 */
async function jsonRpcRequestWithRetry(
  apiKey: string,
  method: string,
  params?: Record<string, unknown>,
  maxAttempts = 2
): Promise<JsonRpcResponse> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await jsonRpcRequest(apiKey, method, params);
    } catch (err) {
      lastError = err as Error;
      const isRetryable =
        lastError.name === "AbortError" ||
        lastError.name === "TimeoutError" ||
        lastError.message?.includes("fetch failed");
      if (!isRetryable || attempt === maxAttempts) break;
      await new Promise((r) => setTimeout(r, 2_000));
    }
  }

  throw lastError ?? new Error(`${method} failed after ${maxAttempts} attempts`);
}

export async function fetchRemoteTools(
  apiKey: string
): Promise<RemoteTool[]> {
  const resp = await jsonRpcRequestWithRetry(apiKey, "tools/list");
  if (resp.error) {
    throw new Error(`tools/list error: ${resp.error.message}`);
  }
  return resp.result?.tools ?? [];
}

export async function callRemoteTool(
  apiKey: string,
  name: string,
  args: Record<string, unknown>
): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
  try {
    const resp = await jsonRpcRequestWithRetry(apiKey, "tools/call", {
      name,
      arguments: args,
    });
    if (resp.error) {
      return {
        content: [{ type: "text", text: `Remote error: ${resp.error.message}` }],
        isError: true,
      };
    }
    return {
      content: resp.result?.content ?? [{ type: "text", text: "No content returned" }],
      isError: resp.result?.isError,
    };
  } catch (err) {
    const lastError = err as Error;
    return {
      content: [{ type: "text", text: `Remote call failed after retry: ${lastError.message ?? "unknown error"}` }],
      isError: true,
    };
  }
}

/**
 * Converts one JSON Schema property into a Zod type. Recursive: arrays keep
 * their item type and objects keep their properties, so remote tools can take
 * structured input (e.g. suggest_insight's `insights: [{title, insight, ...}]`).
 */
function jsonSchemaToZod(prop: Record<string, unknown>): z.ZodTypeAny {
  if (prop.oneOf) {
    // e.g. oneOf: [{type:"number"},{type:"string"}] → union
    return z.union([z.number(), z.string()]);
  }
  switch (prop.type) {
    case "string":
      return Array.isArray(prop.enum) && prop.enum.length > 0
        ? z.enum(prop.enum as [string, ...string[]])
        : z.string();
    case "number":
    case "integer":
      return z.number();
    case "boolean":
      return z.boolean();
    case "array": {
      const items = prop.items as Record<string, unknown> | undefined;
      return z.array(items ? jsonSchemaToZod(items) : z.any());
    }
    case "object":
      return prop.properties
        ? z.object(jsonSchemaToZodShape(prop)).passthrough()
        : z.record(z.any());
    default:
      return z.any();
  }
}

/**
 * Converts a JSON Schema inputSchema into a Zod shape for McpServer.tool().
 */
function jsonSchemaToZodShape(
  inputSchema: Record<string, unknown>
): Record<string, z.ZodTypeAny> {
  const properties = (inputSchema.properties ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const required = new Set((inputSchema.required as string[]) ?? []);
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, prop] of Object.entries(properties)) {
    let field = jsonSchemaToZod(prop);
    if (prop.description) {
      field = field.describe(prop.description as string);
    }
    if (!required.has(key)) {
      field = field.optional();
    }
    shape[key] = field;
  }

  return shape;
}

/**
 * Register an already-fetched array of remote tools on the server.
 */
export function registerFetchedTools(
  server: McpServer,
  apiKey: string,
  tools: RemoteTool[]
): void {
  for (const tool of tools) {
    const zodShape = jsonSchemaToZodShape(tool.inputSchema);

    server.tool(tool.name, tool.description, zodShape, async (args) => {
      const result = await callRemoteTool(apiKey, tool.name, args);
      return {
        content: result.content.map((c) => ({
          type: "text" as const,
          text: c.text,
        })),
        isError: result.isError,
      };
    });
  }
}

export async function fetchRemotePrompts(
  apiKey: string
): Promise<RemotePrompt[]> {
  const resp = await jsonRpcRequestWithRetry(apiKey, "prompts/list");
  if (resp.error) {
    throw new Error(`prompts/list error: ${resp.error.message}`);
  }
  return resp.result?.prompts ?? [];
}

async function getRemotePrompt(
  apiKey: string,
  name: string,
  args: Record<string, string>
): Promise<RemotePromptMessage[]> {
  const resp = await jsonRpcRequestWithRetry(apiKey, "prompts/get", {
    name,
    arguments: args,
  });
  if (resp.error) {
    throw new Error(`prompts/get error: ${resp.error.message}`);
  }
  return resp.result?.messages ?? [];
}

/**
 * Register an already-fetched array of remote prompts on the server.
 */
export function registerFetchedPrompts(
  server: McpServer,
  apiKey: string,
  prompts: RemotePrompt[]
): void {
  for (const prompt of prompts) {
    const zodShape: Record<string, z.ZodTypeAny> = {};
    for (const arg of prompt.arguments) {
      let field: z.ZodTypeAny = z.string().describe(arg.description);
      if (!arg.required) {
        field = field.optional();
      }
      zodShape[arg.name] = field;
    }

    server.prompt(
      prompt.name,
      prompt.description,
      zodShape,
      async (args) => {
        const messages = await getRemotePrompt(
          apiKey,
          prompt.name,
          args as Record<string, string>
        );
        return {
          messages: messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: {
              type: "text" as const,
              text: m.content.text,
            },
          })),
        };
      }
    );
  }
}

