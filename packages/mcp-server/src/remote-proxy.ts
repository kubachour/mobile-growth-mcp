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
  const body: Record<string, unknown> = {
    jsonrpc: "2.0",
    method,
    id: nextRequestId++,
  };
  if (params) body.params = params;

  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Edge Function error (${res.status}): ${text}`);
  }

  return (await res.json()) as JsonRpcResponse;
}

export async function fetchRemoteTools(
  apiKey: string
): Promise<RemoteTool[]> {
  const resp = await jsonRpcRequest(apiKey, "tools/list");
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
  const resp = await jsonRpcRequest(apiKey, "tools/call", {
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
}

/**
 * Converts a JSON Schema inputSchema into a Zod shape for McpServer.tool().
 * Handles string, number, boolean, array (of strings), and oneOf [number, string].
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
    let field: z.ZodTypeAny;

    if (prop.oneOf) {
      // e.g. oneOf: [{type:"number"},{type:"string"}] → union
      field = z.union([z.number(), z.string()]);
    } else if (prop.type === "string") {
      field = z.string();
    } else if (prop.type === "number") {
      field = z.number();
    } else if (prop.type === "boolean") {
      field = z.boolean();
    } else if (prop.type === "array") {
      field = z.array(z.string());
    } else {
      field = z.any();
    }

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

export async function registerRemoteTools(
  server: McpServer,
  apiKey: string
): Promise<void> {
  let tools: RemoteTool[];
  try {
    tools = await fetchRemoteTools(apiKey);
  } catch (err) {
    console.error(
      `Failed to fetch remote tools: ${(err as Error).message}. KB tools will not be available.`
    );
    return;
  }

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

async function fetchRemotePrompts(
  apiKey: string
): Promise<RemotePrompt[]> {
  const resp = await jsonRpcRequest(apiKey, "prompts/list");
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
  const resp = await jsonRpcRequest(apiKey, "prompts/get", {
    name,
    arguments: args,
  });
  if (resp.error) {
    throw new Error(`prompts/get error: ${resp.error.message}`);
  }
  return resp.result?.messages ?? [];
}

export async function registerRemotePrompts(
  server: McpServer,
  apiKey: string
): Promise<void> {
  let remotePrompts: RemotePrompt[];
  try {
    remotePrompts = await fetchRemotePrompts(apiKey);
  } catch (err) {
    console.error(
      `Failed to fetch remote prompts: ${(err as Error).message}. Prompts will not be available.`
    );
    return;
  }

  for (const prompt of remotePrompts) {
    // Build Zod shape from arguments
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
