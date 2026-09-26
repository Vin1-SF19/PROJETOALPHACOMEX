import "server-only";

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { RoadmapMcpAuthError, resolveRoadmapMcpIdentity } from "./auth";
import { createRoadmapMcpServer } from "./server";
import { validateAlphaSeoMcpHostAndOrigin } from "@/lib/alpha-seo/mcp/host-policy";

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

export async function handleRoadmapMcpRequest(request: Request): Promise<Response> {
  const rejected = validateAlphaSeoMcpHostAndOrigin(request);
  if (rejected) return withCors(rejected, request);
  if (request.method === "OPTIONS") return withCors(new Response(null, { status: 204 }), request);
  try {
    const identity = await resolveRoadmapMcpIdentity(request);
    const accept = request.headers.get("accept") ?? "";
    const legacyJson =
      request.headers.get("x-roadmap-mcp-legacy") === "json" ||
      (!accept.includes("text/event-stream") && accept.includes("application/json"));
    const server = createRoadmapMcpServer(identity);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: legacyJson,
    });
    try {
      await server.connect(transport);
      return withCors(await transport.handleRequest(request), request);
    } finally {
      await Promise.allSettled([transport.close(), server.close()]);
    }
  } catch (error) {
    const status = error instanceof RoadmapMcpAuthError ? error.status : 500;
    const code = error instanceof RoadmapMcpAuthError ? error.code : "MCP_REQUEST_FAILED";
    const message =
      error instanceof RoadmapMcpAuthError
        ? error.message
        : "Falha ao processar a requisição MCP.";
    const headers =
      status === 401
        ? { "WWW-Authenticate": `Bearer realm="roadmap-production", scope="roadmap:read"` }
        : undefined;
    return withCors(
      Response.json(
        {
          jsonrpc: "2.0",
          error: {
            code: status === 401 ? -32001 : status === 403 ? -32003 : -32603,
            message,
            data: { code },
          },
          id: null,
        },
        { status, headers },
      ),
      request,
    );
  }
}
