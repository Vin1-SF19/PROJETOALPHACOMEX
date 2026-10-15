import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { revalidatePath } from "next/cache";
import { notificarNovoChamado } from "@/lib/chamados/notificacoes-server";
import { criarChamadoSchema, primeiraMensagemZod } from "@/lib/chamados/schemas";
import { criarChamadoMultissetorial, ErroCriacaoChamado } from "@/lib/chamados/criacao";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sessão expirada" }, { status: 401 });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Dados do chamado inválidos" }, { status: 400 });
  }
  const parsed = criarChamadoSchema.strict().safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: primeiraMensagemZod(parsed.error) }, { status: 400 });

  try {
    const chamado = await criarChamadoMultissetorial(Number(session.user.id), parsed.data, { origemBibble: true });
    // A persistência continua autoritativa se o transporte de notificações falhar.
    try {
      await notificarNovoChamado({
        chamadoId: chamado.id, titulo: chamado.titulo, usuario: chamado.autor.nome,
        usuarioId: chamado.autor.id, setor: chamado.autor.role, setorOrigem: chamado.autor.role,
        setorDestinoId: chamado.setorDestinoId, setorDestinoNome: chamado.setorDestinoNome,
        tecnicoSolicitadoId: chamado.tecnicoSolicitadoId, urgencia: chamado.prioridade,
        createdAt: chamado.createdAt.toISOString(),
      });
    } catch {
      console.warn("[AbrirChamado] Falha ao entregar notificação do chamado persistido");
    }
    revalidatePath("/PainelAlpha/Chamados");
    return NextResponse.json({ success: true, id: chamado.id });
  } catch (error) {
    if (error instanceof ErroCriacaoChamado) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("[AbrirChamado] Falha ao criar chamado");
    return NextResponse.json({ error: "Erro ao criar via Bibble" }, { status: 500 });
  }
}
