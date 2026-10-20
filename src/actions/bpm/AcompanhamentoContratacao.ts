"use server";

import { z } from "zod";
import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { CHAVES_CAMPOS } from "@/lib/bpm/financeiro-config.client";
import { publicarEventoBpm } from "@/lib/bpm/automacoes/eventos";
import { acessoAcompanhamentoComercial, carregarAcompanhamentoComercial, idTarefaContratacao, registrarEventoAcompanhamento } from "@/lib/bpm/contratacao-comercial-server";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";

export async function ObterAcompanhamentoContratacaoBpm(cardId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Não autorizado");
    const podeAgir = await acessoAcompanhamentoComercial(cardId, Number(session.user.id), session.user.role ?? null);
    const contexto = await carregarAcompanhamentoComercial(cardId);
    if (!contexto) return { success: true as const, data: null };
    const { comercial, financeiro, documento } = contexto;
    const tarefa = await db.bpmTarefa.findUnique({ where: { id: idTarefaContratacao("pagamento", cardId, financeiro.id) }, select: { id: true, status: true } });
    return { success: true as const, data: {
      podeAgir, envioJaAcompanhado: contexto.envioJaAcompanhado, versao: comercial.updatedAt.toISOString(), status: comercial.statusPosFechamento,
      contratoUrl: documento ? `/api/bpm/cards/${encodeURIComponent(cardId)}/contrato` : null,
      contratoNome: documento?.nome ?? null, pagamentoEncaminhado: Boolean(tarefa), conferenciaConcluida: tarefa?.status === "CONCLUIDA", financeiroConcluido: financeiro.status === "CONCLUIDO",
    } };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Não foi possível carregar a contratação." };
  }
}

const schema = z.object({ cardId: z.string().min(1).max(120), versao: z.string().datetime(), acao: z.enum(["REGISTRAR_ENVIO", "CONFERIR_PAGAMENTO"]) }).strict();

export async function AtualizarAcompanhamentoContratacaoBpm(input: unknown) {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new Error("Solicitação inválida. Recarregue o card.");
    const session = await auth();
    if (!session?.user?.id) throw new Error("Não autorizado");
    const usuarioId = Number(session.user.id);
    const { cardId, versao, acao } = parsed.data;
    const resultado = await db.$transaction(async (tx) => {
      if (!await acessoAcompanhamentoComercial(cardId, usuarioId, session.user.role ?? null, tx)) throw new Error("Não autorizado");
      const contexto = await carregarAcompanhamentoComercial(cardId, tx);
      if (!contexto) throw new Error("A contratação financeira ainda não está vinculada.");
      const { comercial, financeiro, documento } = contexto;
      const envio = acao === "REGISTRAR_ENVIO";
      const tarefaId = idTarefaContratacao(envio ? "envio" : "pagamento", cardId, financeiro.id);
      const tarefa = await tx.bpmTarefa.findUnique({ where: { id: tarefaId }, select: { id: true, status: true } });
      if ((!envio && tarefa) || (envio && tarefa?.status === "CONCLUIDA" && comercial.statusPosFechamento === "CONTRATO_ENVIADO")) return { alterado: false, pipelineIds: [] };
      if (comercial.updatedAt.toISOString() !== versao) throw new Error("O card mudou. Recarregue antes de continuar.");
      if (envio && contexto.envioJaAcompanhado) throw new Error("O Financeiro já registrou avanço desta contratação. Recarregue o card.");
      if (envio && !documento) throw new Error("Aguarde o Financeiro concluir a elaboração e validar o contrato.");
      if (envio && comercial.statusPosFechamento && !["AGUARDANDO_CONTRATO", "CONTRATO_A_ENVIAR"].includes(comercial.statusPosFechamento))
        throw new Error("O acompanhamento já avançou. Recarregue o card.");
      if (financeiro.status === "CONCLUIDO") throw new Error("Esta contratação financeira já foi concluída.");
      // A confirmação comercial só solicita a conferência. Não altera pagamento/assinatura financeiros.
      const atualizado = await tx.bpmCard.updateMany({ where: { id: cardId, updatedAt: comercial.updatedAt }, data: {
        ...(envio ? { statusPosFechamento: "CONTRATO_ENVIADO" } : {}),
        updatedAt: new Date(Math.max(Date.now(), comercial.updatedAt.getTime() + 1)), versao: { increment: 1 },
      } });
      if (atualizado.count !== 1) throw new Error("O card mudou. Recarregue antes de continuar.");
      // A mesma transação protege o vínculo/estado financeiro contra movimentação concorrente.
      const financeiroAtualizado = await tx.bpmCard.updateMany({ where: { id: financeiro.id, updatedAt: financeiro.updatedAt }, data: {
        updatedAt: new Date(Math.max(Date.now(), financeiro.updatedAt.getTime() + 1)), versao: { increment: 1 },
      } });
      if (financeiroAtualizado.count !== 1) throw new Error("O Financeiro mudou. Recarregue antes de continuar.");
      if (envio) {
        const campoEnvio = await tx.bpmCampo.findFirst({ where: { chave: CHAVES_CAMPOS.CONTRATO_ENVIADO, ativo: true,
          OR: [{ pipelineId: financeiro.pipelineId }, { pipelinesAssociados: { some: { pipelineId: financeiro.pipelineId } } }] }, select: { id: true } });
        if (!campoEnvio) throw new Error("O campo de envio do Financeiro precisa ser configurado.");
        const anterior = await tx.bpmCardCampoValor.findUnique({ where: { cardId_campoId: { cardId: financeiro.id, campoId: campoEnvio.id } }, select: { valor: true } });
        if (anterior?.valor !== "Sim") {
          await tx.bpmCardCampoValor.upsert({ where: { cardId_campoId: { cardId: financeiro.id, campoId: campoEnvio.id } },
            create: { cardId: financeiro.id, campoId: campoEnvio.id, valor: "Sim" }, update: { valor: "Sim" } });
          await publicarEventoBpm({ tipo: "CAMPO_ALTERADO", entidadeTipo: "CAMPO", entidadeId: campoEnvio.id,
            cardId: financeiro.id, pipelineId: financeiro.pipelineId, atorTipo: "USUARIO", atorUserId: usuarioId,
            valorAnterior: { campoId: campoEnvio.id, valor: anterior?.valor ?? null }, valorNovo: { campoId: campoEnvio.id, valor: "Sim" },
            correlationId: tarefaId, idempotencyKey: `${tarefaId}:envio-financeiro` }, tx);
        }
      }
      await tx.bpmTarefa.upsert({ where: { id: tarefaId }, create: {
        id: tarefaId, cardId: envio ? cardId : financeiro.id, titulo: envio ? "Enviar contrato" : "Conferir pagamento informado pelo Comercial",
        responsavelId: envio ? comercial.responsavelId : financeiro.responsavelId,
        descricao: envio ? "Envio registrado pelo Comercial." : `Conferir o recebimento referente ao card comercial ${cardId}. Este registro não confirma o pagamento.`,
        status: envio ? "CONCLUIDA" : "PENDENTE", concluidaEm: envio ? new Date() : null,
      }, update: envio ? { status: "CONCLUIDA", concluidaEm: new Date() } : {} });
      const novo = { financeiroCardId: financeiro.id, comercialCardId: cardId, ...(envio ? { statusPosFechamento: "CONTRATO_ENVIADO", anexoId: documento!.anexoId } : { tarefaId, pagamento: "AGUARDANDO_CONFERENCIA" }) };
      for (const card of [comercial, financeiro]) await registrarEventoAcompanhamento(tx, {
        cardId: card.id, pipelineId: card.pipelineId, usuarioId, acao: envio ? "CONTRATO_ENVIO_REGISTRADO" : "PAGAMENTO_ENCAMINHADO_CONFERENCIA",
        chave: `${tarefaId}:${acao}:${card.id}`, anterior: card.id === comercial.id ? { statusPosFechamento: comercial.statusPosFechamento } : undefined, novo,
      });
      return { alterado: true, pipelineIds: [comercial.pipelineId, financeiro.pipelineId] };
    });
    for (const pipelineId of resultado.pipelineIds) await notificarPipelineBpm({ pipelineId, tipo: "CARD_ATUALIZADO" });
    return { success: true as const, alterado: resultado.alterado };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Não foi possível registrar a ação." };
  }
}
