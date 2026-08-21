import { MCP_ALLOWED_SCOPES } from "@/lib/alpha-seo/mcp/auth";
import { alphaSeoMcpPublicOrigin, validateAlphaSeoMcpHostAndOrigin } from "@/lib/alpha-seo/mcp/host-policy";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rejected = validateAlphaSeoMcpHostAndOrigin(request);
  if (rejected) return rejected;
  const origin = alphaSeoMcpPublicOrigin(request);
  const base = `${origin}/api/alpha-seo/mcp`;
  return Response.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    revocation_endpoint: `${base}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: MCP_ALLOWED_SCOPES,
  }, { headers: { "Cache-Control": "public, max-age=300" } });
}
