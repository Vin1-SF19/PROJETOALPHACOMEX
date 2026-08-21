import "server-only";

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { AlphaSeoMcpAuthError, resolveAlphaSeoMcpIdentity } from "./auth";
import { validateAlphaSeoMcpHostAndOrigin } from "./host-policy";
import { createAlphaSeoMcpServer } from "./server";

const CORS_ALLOW_HEADERS = "Content-Type, Accept, Authorization, MCP-Protocol-Version, mcp-session-id";
const CORS_EXPOSE_HEADERS = "mcp-session-id, MCP-Protocol-Version";

function withCors(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  const origin = request.headers.get("origin");
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Headers", CORS_ALLOW_HEADERS);
  headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  headers.set("Access-Control-Expose-Headers", CORS_EXPOSE_HEADERS);
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", "Origin, Host, Authorization");
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function handleAlphaSeoMcpRequest(request: Request): Promise<Response> {
  const rejected = validateAlphaSeoMcpHostAndOrigin(request);
  if (rejected) return withCors(rejected, request);
  if (request.method === "OPTIONS") return withCors(new Response(null, { status: 204 }), request);
  try {
    const identity = await resolveAlphaSeoMcpIdentity(request);
    const accept = request.headers.get("accept") ?? "";
    const legacyJson = request.headers.get("x-alpha-seo-mcp-legacy") === "json" || (!accept.includes("text/event-stream") && accept.includes("application/json"));
    const server = createAlphaSeoMcpServer(identity);
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: legacyJson });
    try {
      await server.connect(transport);
      return withCors(await transport.handleRequest(request), request);
    } finally {
      await Promise.allSettled([transport.close(), server.close()]);
    }
  } catch (error) {
    const status = error instanceof AlphaSeoMcpAuthError ? error.status : 500;
    const code = error instanceof AlphaSeoMcpAuthError ? error.code : "MCP_REQUEST_FAILED";
    const message = error instanceof AlphaSeoMcpAuthError ? error.message : "Falha ao processar a requisição MCP.";
    const headers = status === 401 ? { "WWW-Authenticate": `Bearer realm="alpha-seo", scope="alpha-seo:mcp"` } : undefined;
    return withCors(Response.json({ jsonrpc: "2.0", error: { code: status === 401 ? -32001 : status === 403 ? -32003 : -32603, message, data: { code } }, id: null }, { status, headers }), request);
  }
}
