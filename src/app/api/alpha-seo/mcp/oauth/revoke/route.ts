import { revokeMcpToken } from "@/lib/alpha-seo/mcp/oauth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = new URLSearchParams(await request.text());
  const token = body.get("token");
  if (token) await revokeMcpToken(token);
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}

