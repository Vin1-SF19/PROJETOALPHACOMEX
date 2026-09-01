import { auth } from "../../../../../../auth";
import { NextResponse } from "next/server";
import { isAdminRole } from "@/lib/roles";
import { getPermissoesEfetivas } from "@/actions/PermissoesSetor";
import db from "@/lib/prisma";

// Rate limiting simples em memória (5 downloads/min por usuário) — mesmo padrão de contratos/upload
const downloadTimestamps = new Map<string, number[]>();

function verificarRateLimit(userId: string): boolean {
  const agora = Date.now();
  const janela = 60 * 1000;
  const limite = 5;
  const registros = (downloadTimestamps.get(userId) || []).filter((t) => agora - t < janela);
  if (registros.length >= limite) return false;
  registros.push(agora);
  downloadTimestamps.set(userId, registros);
  return true;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ templateId: string }> },
): Promise<NextResponse> {
  const { templateId: documentoId } = await params;

  const session = await auth();
  const user = session?.user as { id?: string | number; role?: string } | undefined;
  if (!user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const userId = Number(user.id);
  const role = user.role ?? "";
  const isAdmin = isAdminRole(role);

  if (!isAdmin) {
    const perms = await getPermissoesEfetivas(userId);
    if (!perms.includes("geradorDocumentos")) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
  }

  // Ownership check (Artigo V)
  const documento = await db.documentoGerado.findUnique({
    where: { id: documentoId },
    select: { id: true, criadoPorId: true, titulo: true, pdfUrl: true },
  });
  if (!documento) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
  }
  if (!isAdmin && documento.criadoPorId !== userId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  if (!documento.pdfUrl) {
    return NextResponse.json({ error: "PDF ainda não gerado para este documento" }, { status: 404 });
  }

  if (!verificarRateLimit(String(userId))) {
    return NextResponse.json(
      { error: "Limite de downloads atingido. Tente novamente em alguns minutos." },
      { status: 429 },
    );
  }

  // Busca o PDF do Vercel Blob
  try {
    const res = await fetch(documento.pdfUrl);
    if (!res.ok) {
      return NextResponse.json({ error: "Falha ao buscar o PDF" }, { status: 502 });
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const filename = `${documento.titulo.replace(/[^a-zA-Z0-9à-úÀ-Ú\s-]/g, "").trim() || "documento"}.pdf`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch {
    return NextResponse.json({ error: "Erro ao buscar o PDF" }, { status: 502 });
  }
}
