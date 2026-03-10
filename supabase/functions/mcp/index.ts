// Supabase Edge Function: Remote MCP server (Streamable HTTP, stateless)
// Deploy with: supabase functions deploy mcp --no-verify-jwt

import { Server } from "npm:@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "npm:@modelcontextprotocol/sdk/types.js";
import { WebStandardStreamableHTTPServerTransport } from "npm:@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { validateApiKey } from "../_shared/auth.ts";
import { tools } from "../_shared/tools.ts";
import { prompts } from "../_shared/prompts.ts";
import { promptContent } from "../_shared/prompt-content.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-api-key, x-client-info, apikey, content-type, mcp-session-id, mcp-protocol-version",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Expose-Headers": "mcp-session-id",
};

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Auth: validate x-api-key
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32000, message: "Missing x-api-key header" },
      }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const auth = await validateApiKey(apiKey, supabase);
  if (!auth.valid) {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32000, message: "Invalid API key" },
      }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Fire-and-forget usage logger
  const logUsage = (method: string, name: string, isError = false) => {
    supabase
      .from("api_key_usage")
      .insert({ key_id: auth.key_id, method, name, is_error: isError })
      .then(({ error }) => {
        if (error) console.error(`[usage] log failed: ${error.message}`);
      });
  };

  // Filter tools by admin status
  const visibleTools = tools.filter((t) => !t.adminOnly || auth.is_admin);

  // Create a fresh stateless low-level Server per request
  const server = new Server(
    { name: "meta-editor", version: "2.0.0" },
    { capabilities: { tools: {}, prompts: {} } }
  );

  // tools/list — return tool definitions with proper inputSchema
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: visibleTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  // tools/call — dispatch to the matching handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tool = visibleTools.find((t) => t.name === name);

    if (!tool) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    try {
      const content = await tool.handler(args ?? {}, supabase);
      logUsage("tool", name);
      return { content };
    } catch (err) {
      logUsage("tool", name, true);
      return {
        content: [{ type: "text", text: (err as Error).message }],
        isError: true,
      };
    }
  });

  // prompts/list — return prompt metadata
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: prompts.map((p) => ({
      name: p.name,
      description: p.description,
      arguments: p.arguments,
    })),
  }));

  // prompts/get — return full prompt content with argument context prepended
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const prompt = prompts.find((p) => p.name === name);

    if (!prompt) {
      throw new Error(`Unknown prompt: ${name}`);
    }

    const content = promptContent[name];
    if (!content) {
      throw new Error(`No content found for prompt: ${name}`);
    }

    // Build context prefix from arguments
    const parts: string[] = [];
    if (args?.ad_account_id) {
      parts.push(`Ad account: ${args.ad_account_id}`);
    }
    if (args?.campaign_id_a) {
      parts.push(`Campaign A: ${args.campaign_id_a}`);
    }
    if (args?.campaign_id_b) {
      parts.push(`Campaign B: ${args.campaign_id_b}`);
    }

    const text = parts.length > 0
      ? `${parts.join("\n")}\n\n${content}`
      : content;

    logUsage("prompt", name);

    return {
      messages: [
        {
          role: "user" as const,
          content: { type: "text", text },
        },
      ],
    };
  });

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,
  });

  await server.connect(transport);

  const response = await transport.handleRequest(req);

  // Append CORS headers to the response
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});
