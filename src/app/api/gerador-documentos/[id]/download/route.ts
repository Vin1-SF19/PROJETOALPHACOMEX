import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { auth } from "../../../../../../auth";
import db from "@/lib/prisma";

/**
 * GET /api/gerador-documentos/[id]/download
 *
 * Baixa o PDF de um documento gerado com headers corretos:
 * - Content-Type: application/pdf
 * - Content-Disposition: attachment; filename="contrato_....pdf"
 * - Content-Length: tamanho real do arquivo
 *
 * Requer autenticação (auth()) + ownership (dono ou admin).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
  }

  const documento = await db.documentoGerado.findUnique({
    where: { id },
    select: { id: true, titulo: true, pdfUrl: true, criadoPorId: true },
  });
  if (!documento) {
    return NextResponse.json({ success: false, error: "Documento não encontrado" }, { status: 404 });
  }

  const isAdmin = (session.user as { role?: string }).role === "Admin" || (session.user as { role?: string }).role === "CEO";
  if (!isAdmin && documento.criadoPorId !== (session.user as { id?: number }).id) {
    return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 403 });
  }

  if (!documento.pdfUrl) {
    return NextResponse.json({ success: false, error: "PDF ainda não gerado para este documento" }, { status: 404 });
  }

  try {
    const blob = await get(documento.pdfUrl);
    const filename = `contrato_${documento.id}.pdf`;

    return new NextResponse(blob.body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(blob.size),
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Falha ao baixar o PDF" }, { status: 500 });
  }
}
