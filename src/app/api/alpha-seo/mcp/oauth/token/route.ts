import { exchangeMcpAuthorizationCode, rotateMcpRefreshToken } from "@/lib/alpha-seo/mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = new URLSearchParams(await request.text());
    const grantType = body.get("grant_type");
    const result = grantType === "authorization_code"
      ? await exchangeMcpAuthorizationCode({ request, body })
      : grantType === "refresh_token"
        ? await rotateMcpRefreshToken({ request, body })
        : null;
    if (!result) return Response.json({ error: "unsupported_grant_type" }, { status: 400 });
    return Response.json(result, { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "INVALID_GRANT";
    const invalidClient = message === "INVALID_CLIENT";
    return Response.json({ error: invalidClient ? "invalid_client" : message.includes("SCOPE") ? "invalid_scope" : "invalid_grant", error_description: invalidClient ? "Credenciais do cliente inválidas." : "Grant, PKCE ou refresh token inválido." }, { status: invalidClient ? 401 : 400, headers: { "Cache-Control": "no-store" } });
  }
}

