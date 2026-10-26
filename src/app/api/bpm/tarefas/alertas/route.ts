import { NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import db from "@/lib/prisma";
import { checarAcessoBpmCard, checarAcessoModuloBpm } from "@/lib/bpm/ownership";
import { TIPO_TAREFA_PROXIMO_CONTATO } from "@/lib/bpm/proximo-contato-agenda";
import type { AlertaTarefaBpm } from "@/lib/bpm/notificacoes-tarefas";
import { erroTimeoutConexaoAlertas, repetirLeituraAlertas } from "@/lib/bpm/alertas-leitura-retry";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

/** Reconciliação somente leitura: inclui lembretes antigos marcados sem entrega. */
export async function GET(request: Request) {
  try {
    const session = await auth();
    const usuarioId = Number(session?.user?.id);
    if (!session?.user?.id || !Number.isSafeInteger(usuarioId) || usuarioId <= 0) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers });
    }
    return await repetirLeituraAlertas(async () => {
      if (!await checarAcessoModuloBpm(usuarioId)) {
        return NextResponse.json({ error: "Sem acesso ao CRM" }, { status: 403, headers });
      }
      const cursor = new URL(request.url).searchParams.get("cursor");
      if (cursor && cursor.length > 200) return NextResponse.json({ error: "Cursor inválido" }, { status: 400, headers });
      const tarefas = await db.bpmTarefa.findMany({
        where: {
          status: "PENDENTE", alertaEm: { lte: new Date() },
          tipo: { not: TIPO_TAREFA_PROXIMO_CONTATO },
          OR: [{ responsavelId: usuarioId }, { responsavelId: null, card: { responsavelId: usuarioId } }],
          card: { status: { not: "ARQUIVADO" }, pipeline: { ativo: true } },
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        orderBy: { id: "asc" }, take: 51,
        select: {
          id: true, cardId: true, titulo: true, descricao: true, tipo: true, prioridade: true,
          prazo: true, alertaEm: true, responsavel: { select: { nome: true } },
          card: { select: {
            pipelineId: true, empresa: { select: { razaoSocial: true } },
            pipeline: { select: { nome: true } }, etapa: { select: { nome: true } },
            responsavel: { select: { nome: true } },
          } },
        },
      });
      const pagina = tarefas.slice(0, 50);
      const acessos = new Map<string, ReturnType<typeof checarAcessoBpmCard>>();
      const alertas = await Promise.all(pagina.map(async (tarefa): Promise<AlertaTarefaBpm | null> => {
        if (!acessos.has(tarefa.cardId)) acessos.set(tarefa.cardId,
          checarAcessoBpmCard(tarefa.cardId, usuarioId, session.user.role ?? null, "visualizar"));
        if (!(await acessos.get(tarefa.cardId))?.autorizado || !tarefa.alertaEm) return null;
        const alertaEm = tarefa.alertaEm.toISOString();
        return {
          id: `${tarefa.id}:${alertaEm}`, tarefaId: tarefa.id, cardId: tarefa.cardId,
          pipelineId: tarefa.card.pipelineId, titulo: tarefa.titulo, descricao: tarefa.descricao,
          tipo: tarefa.tipo, prioridade: tarefa.prioridade, alertaEm, prazo: tarefa.prazo?.toISOString() ?? null,
          empresaNome: tarefa.card.empresa.razaoSocial, pipelineNome: tarefa.card.pipeline.nome,
          etapaNome: tarefa.card.etapa.nome, responsavelNome: tarefa.responsavel?.nome ?? tarefa.card.responsavel.nome,
        };
      }));
      return NextResponse.json({ alertas: alertas.filter((alerta) => alerta !== null),
        nextCursor: tarefas.length > 50 ? pagina.at(-1)!.id : null }, { headers });
    }, request.signal);
  } catch (error) {
    if (erroTimeoutConexaoAlertas(error)) {
      console.warn("[BpmTarefas/alertas] Conexão temporariamente indisponível", { code: "UND_ERR_CONNECT_TIMEOUT" });
      return NextResponse.json({ error: "Alertas temporariamente indisponíveis. Tente novamente em instantes." },
        { status: 503, headers: { ...headers, "Retry-After": "30" } });
    }
    console.error("[BpmTarefas/alertas]", error);
    return NextResponse.json({ error: "Não foi possível carregar os alertas" }, { status: 500, headers });
  }
}
