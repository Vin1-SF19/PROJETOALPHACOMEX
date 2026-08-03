import { auth } from "../../../../../../auth";
import db from "@/lib/prisma";
import { NextResponse } from "next/server";
import { isAdminRole } from "@/lib/roles";

const ROLES_GESTAO = ["FINANCEIRO", "RECURSOS HUMANOS"];

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // Auth obrigatória
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const params = await props.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const holerite = await db.holerite.findUnique({
    where: { id },
    select: { id: true, colaboradorId: true, arquivoUrl: true, arquivoNome: true },
  });

  if (!holerite) {
    return NextResponse.json({ error: "Holerite não encontrado" }, { status: 404 });
  }

  const userId = Number(user.id);
  const role = user.role || "";
  const podeVerTodos = isAdminRole(role) || ROLES_GESTAO.includes(role);

  // Ownership check — colaborador só baixa o seu
  if (!podeVerTodos && holerite.colaboradorId !== userId) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  // Stream do PDF sem expor a URL do Blob
  try {
    const response = await fetch(holerite.arquivoUrl);
    if (!response.ok) {
      return NextResponse.json({ error: "Arquivo não disponível" }, { status: 502 });
    }

    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(holerite.arquivoNome)}"`,
        "Cache-Control": "no-store, no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    const err = e as Error;
    // Log sem PII
    console.error("[holerites/download] holeriteId=" + id, err.message);
    return NextResponse.json({ error: "Erro ao obter arquivo" }, { status: 500 });
  }
}
