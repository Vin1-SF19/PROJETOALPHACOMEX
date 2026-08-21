import { requireAlphaSeoProjectAccess } from "@/lib/alpha-seo/project-access";
import { createMcpAuthorizationCode, oauthAuthorizeSchema } from "@/lib/alpha-seo/mcp/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function objectFromParams(params: URLSearchParams) {
  return Object.fromEntries(params.entries());
}

function html(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function consentPage(params: URLSearchParams): Response {
  const fields = [...params.entries()].map(([key, value]) => `<input type="hidden" name="${html(key)}" value="${html(value)}">`).join("");
  const projectId = params.get("project_id") ?? "";
  const scope = params.get("scope") ?? "";
  const body = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Autorizar Alpha SEO MCP</title><style>body{font-family:system-ui;background:#020617;color:#e2e8f0;display:grid;place-items:center;min-height:100vh;margin:0}.card{max-width:560px;background:#0f172a;border:1px solid #334155;border-radius:16px;padding:28px}code{word-break:break-all;color:#7dd3fc}button{background:#0ea5e9;color:#001018;border:0;border-radius:10px;padding:12px 18px;font-weight:700;cursor:pointer}</style></head><body><main class="card"><h1>Autorizar Alpha SEO MCP</h1><p>O cliente solicita acesso ao projeto <code>${html(projectId)}</code> com os scopes <code>${html(scope)}</code>.</p><p>A autorização fica vinculada ao seu usuário e pode ser revogada.</p><form method="post">${fields}<input type="hidden" name="consent" value="approve"><button type="submit">Autorizar este projeto</button></form></main></body></html>`;
  return new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = oauthAuthorizeSchema.safeParse(objectFromParams(url.searchParams));
  if (!parsed.success) return Response.json({ error: "invalid_request", error_description: "Parâmetros OAuth inválidos." }, { status: 400 });
  try {
    await requireAlphaSeoProjectAccess({ projectId: parsed.data.project_id, action: "project:read" });
    return consentPage(url.searchParams);
  } catch {
    return Response.json({ error: "access_denied", error_description: "Entre no Painel Alpha e confirme o acesso a este projeto." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.formData();
    if (body.get("consent") !== "approve") return Response.json({ error: "access_denied" }, { status: 403 });
    const payload = Object.fromEntries([...body.entries()].filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[0] !== "consent"));
    const parsed = oauthAuthorizeSchema.parse(payload);
    const access = await requireAlphaSeoProjectAccess({ projectId: parsed.project_id, action: "project:read" });
    const result = await createMcpAuthorizationCode({ payload: parsed, userId: access.userId });
    return Response.redirect(result.redirect, 303);
  } catch {
    return Response.json({ error: "access_denied", error_description: "Não foi possível conceder acesso ao projeto." }, { status: 403 });
  }
}

