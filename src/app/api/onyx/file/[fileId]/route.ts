import { mapearIndisponibilidadeAuth } from "@/lib/auth/indisponibilidade";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../../auth";

export const dynamic = "force-dynamic";

// GET /api/onyx/file/[fileId] — serve um arquivo de chat do Onyx (ex: imagem gerada).
// Proxy autenticado: o browser não pode buscar direto (exige o token do Onyx).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  try {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const fileId = (await params).fileId;
  if (!fileId) return NextResponse.json({ error: "Arquivo inválido" }, { status: 400 });
  void fileId;
  return NextResponse.json({ error: "Arquivos Onyx indisponíveis sem prova de ownership" }, { status: 403 });

  } catch (authError) {
    const unavailable = mapearIndisponibilidadeAuth(authError);
    if (unavailable) return unavailable;
    throw authError;
  }
}
