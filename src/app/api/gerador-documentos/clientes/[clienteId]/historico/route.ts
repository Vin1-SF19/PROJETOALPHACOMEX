import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import db from "@/lib/prisma";

/**
 * GET /api/gerador-documentos/clientes/[clienteId]/historico
 *
 * Retorna todos os documentos (contratos) vinculados a um cliente,
 * incluindo o PDF quando disponível.
 *
 * Requer autenticação (auth()) + permissão de acesso ao módulo.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ clienteId: string }> },
) {
  const { clienteId } = await params;
  const id = parseInt(clienteId, 10);
  if (isNaN(id)) {
    return NextResponse.json({ success: false, error: "clienteId inválido" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Não autenticado" }, { status: 401 });
  }

  const isAdmin = (session.user as { role?: string }).role === "Admin" || (session.user as { role?: string }).role === "CEO";
  const userId = (session.user as { id?: number }).id;

  const documentos = await db.documentoGerado.findMany({
    where: {
      clienteId: id,
      ...(isAdmin ? {} : { criadoPorId: userId }),
    },
    orderBy: { criadoEm: "desc" },
    select: {
      id: true,
      titulo: true,
      status: true,
      pdfUrl: true,
      criadoEm: true,
      finalizadoEm: true,
      empresaContratada: { select: { razaoSocial: true, cnpj: true } },
    },
  });

  return NextResponse.json({
    success: true,
    data: documentos.map((doc) => ({
      ...doc,
      downloadUrl: doc.pdfUrl ? `/api/gerador-documentos/${doc.id}/download` : null,
    })),
  });
}
