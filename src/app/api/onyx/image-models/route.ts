import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { listImageModels, setDefaultImageModel, OnyxError } from "@/lib/onyx/client";
import { isAdminRole } from "@/lib/onyx/ownership";

export const dynamic = "force-dynamic";

// GET /api/onyx/image-models — lista os modelos de geração de imagem (admin).
// ATENÇÃO: o modelo é um DEFAULT GLOBAL no Onyx (afeta todos os usuários).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role ?? "";
  if (!isAdminRole(role)) {
    return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  }
  try {
    const models = await listImageModels();
    return NextResponse.json({ models });
  } catch (err) {
    const status = err instanceof OnyxError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}

// POST /api/onyx/image-models — define o modelo padrão (global). Admin only.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role ?? "";
  if (!isAdminRole(role)) {
    return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { imageProviderId?: string };
  if (!body.imageProviderId) {
    return NextResponse.json({ error: "imageProviderId obrigatório." }, { status: 400 });
  }

  try {
    await setDefaultImageModel(body.imageProviderId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const status = err instanceof OnyxError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
