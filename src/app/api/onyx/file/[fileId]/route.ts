import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import { getChatFile, OnyxError } from "@/lib/onyx/client";

export const dynamic = "force-dynamic";

// GET /api/onyx/file/[fileId] — serve um arquivo de chat do Onyx (ex: imagem gerada).
// Proxy autenticado: o browser não pode buscar direto (exige o token do Onyx).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const fileId = (await params).fileId;
  if (!fileId) return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });

  try {
    const res = await getChatFile(fileId);
    if (!res.ok || !res.body) {
      return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
    }
    const contentType = res.headers.get("content-type") ?? "image/png";
    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    const status = err instanceof OnyxError ? err.status : 500;
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
