import { registerMcpOAuthClient } from "@/lib/alpha-seo/mcp/oauth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const result = await registerMcpOAuthClient(await request.json());
    return Response.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "invalid_client_metadata", error_description: "Metadados do cliente inválidos." }, { status: 400 });
  }
}

