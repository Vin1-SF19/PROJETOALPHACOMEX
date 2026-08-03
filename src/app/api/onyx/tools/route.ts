import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { listTools, createCustomTool, OnyxError } from "@/lib/onyx/client";
import { isAdminRole } from "@/lib/onyx/ownership";
import { IMAGE_GEN_TOOL_NAME } from "@/lib/onyx/tools-meta";
import { getUserOnyxToken } from "@/lib/onyx/user-token";

export const dynamic = "force-dynamic";

// GET /api/onyx/tools — lista as skills (tools) do Onyx.
// A geração de imagem fica oculta para usuários comuns (só Admin/CEO por enquanto).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role ?? "";
  try {
    const userToken = await getUserOnyxToken(session.user.id);
    let tools = await listTools(userToken);
    if (!isAdminRole(role)) {
      tools = tools.filter(t => t.name !== IMAGE_GEN_TOOL_NAME);
    }
    return NextResponse.json({ tools });
  } catch (err) {
    const status = err instanceof OnyxError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}

// POST /api/onyx/tools — cria uma skill custom (a partir de um schema OpenAPI)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Apenas Admin/CEO podem criar skills (operação sensível: registra endpoints externos)
  const role = (session.user as { role?: string }).role ?? "";
  if (role !== "Admin" && role !== "CEO") {
    return NextResponse.json({ error: "Apenas administradores podem criar skills." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    definition?: Record<string, unknown>;
    custom_headers?: Array<{ key: string; value: string }>;
    passthrough_auth?: boolean;
  };

  if (!body.definition || typeof body.definition !== "object") {
    return NextResponse.json(
      { error: "O campo 'definition' (schema OpenAPI) é obrigatório." },
      { status: 400 },
    );
  }

  try {
    const userToken = await getUserOnyxToken(session.user.id);
    const tool = await createCustomTool({
      definition: body.definition,
      custom_headers: body.custom_headers,
      passthrough_auth: body.passthrough_auth ?? false,
    }, userToken);
    return NextResponse.json({ tool }, { status: 201 });
  } catch (err) {
    const status = err instanceof OnyxError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
