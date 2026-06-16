import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../../../auth";
import { getAgentAvatar, OnyxError } from "@/lib/onyx/client";

export const dynamic = "force-dynamic";

// GET /api/onyx/agents/[id]/avatar — serve a imagem do agente (proxy autenticado)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    const res = await getAgentAvatar(id);
    if (!res.ok || !res.body) {
      return NextResponse.json({ error: "Imagem não encontrada" }, { status: 404 });
    }
    const contentType = res.headers.get("content-type") ?? "image/png";
    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        // cache curto no browser; imagem do agente raramente muda
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    const status = err instanceof OnyxError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
