import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { listOnyxLlmProviders, setOnyxDefaultModel, OnyxError } from "@/lib/onyx/client";
import { isAdminRole } from "@/lib/onyx/ownership";

export const dynamic = "force-dynamic";

// GET /api/onyx/llm-models — lista providers e modelos visíveis. Acessível para todos.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    const providers = await listOnyxLlmProviders();
    return NextResponse.json({ providers });
  } catch (err) {
    const status = err instanceof OnyxError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}

// POST /api/onyx/llm-models — define o modelo padrão global. Admin only.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const role = (session.user as { role?: string }).role ?? "";
  if (!isAdminRole(role)) {
    return NextResponse.json({ error: "Apenas administradores." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    providerId?: number;
    modelName?: string;
  };

  if (!body.providerId || !body.modelName?.trim()) {
    return NextResponse.json({ error: "providerId e modelName são obrigatórios." }, { status: 400 });
  }

  try {
    const providers = await listOnyxLlmProviders();
    const provider = providers.find((p) => p.id === body.providerId);
    if (!provider) {
      return NextResponse.json({ error: "Provider não encontrado." }, { status: 404 });
    }
    const modelExists = provider.model_configurations.some((m) => m.name === body.modelName);
    if (!modelExists) {
      return NextResponse.json({ error: "Modelo não encontrado neste provider." }, { status: 404 });
    }
    await setOnyxDefaultModel(provider, body.modelName!.trim());
    return NextResponse.json({ success: true, modelName: body.modelName });
  } catch (err) {
    const status = err instanceof OnyxError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
