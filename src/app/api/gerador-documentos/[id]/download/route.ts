import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { auth } from "../../../../../../auth";
import { exigirAcessoModulo, exigirOwnershipDocumento } from "@/lib/gerador-documentos/ownership";

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

  let documento;
  try {
    const userId = Number((session.user as { id?: string }).id);
    const role = (session.user as { role?: string }).role ?? null;
    const ctx = await exigirAcessoModulo(userId, role);
    documento = await exigirOwnershipDocumento(id, ctx, "visualizar");
  } catch (error) {
    if (error instanceof Error && error.message === "Documento não encontrado") {
      return NextResponse.json({ success: false, error: "Documento não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 403 });
  }

  if (!documento.pdfUrl) {
    return NextResponse.json({ success: false, error: "PDF ainda não gerado para este documento" }, { status: 404 });
  }

  try {
    const resultado = await get(documento.pdfUrl, { access: "public" });
    if (!resultado || resultado.statusCode !== 200) {
      return NextResponse.json({ success: false, error: "PDF não encontrado no armazenamento" }, { status: 404 });
    }
    const filename = `contrato_${documento.id}.pdf`;

    return new NextResponse(resultado.stream, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(resultado.blob.size),
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Falha ao baixar o PDF" }, { status: 500 });
  }
}
