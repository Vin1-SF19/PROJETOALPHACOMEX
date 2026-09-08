import "server-only";

import { Prisma } from "@prisma/client";
import { registrarHistoricoCard } from "@/lib/bpm/historico-server";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import db from "@/lib/prisma";

const DIA_MS = 86_400_000;

export const CADENCIA_MANUAL_DESABILITADA =
  "CADENCIA_MANUAL_DESABILITADA: a cadência é ativada automaticamente ao entrar no pipeline ou na etapa configurada.";

type Tx = Prisma.TransactionClient;

export type EntradaCadenciaBpm = {
  cardId: string;
  pipelineAnteriorId: string | null;
  etapaAnteriorId: string | null;
  pipelineDestinoId: string;
  etapaDestinoId: string;
  evento: "CARD_CRIADO" | "CARD_MOVIDO";
  usuarioId?: number;
  automacaoOrigem?: string;
  agora?: Date;
};

export type ResultadoAtivacaoCadenciasBpm = {
  alteradas: number;
  canceladas: number;
  criadas: number;
  reativadas: number;
  cadenciaIds: string[];
};

export function chaveExecucaoCicloCadencia(params: {
  vinculoId: string;
  passoId: string;
  iniciadaEm: Date | null;
  createdAt: Date;
}): string {
  return `${params.vinculoId}:${params.passoId}:${(params.iniciadaEm ?? params.createdAt).toISOString()}`;
}

/**
 * Ativa todas as cadências compatíveis com uma entrada real no pipeline/etapa.
 * Deve ser chamada com a mesma transação que cria ou move o card.
 */
export async function ativarCadenciasNaEntradaBpm(
  input: EntradaCadenciaBpm,
  tx: Tx,
): Promise<ResultadoAtivacaoCadenciasBpm> {
  const resultado: ResultadoAtivacaoCadenciasBpm = {
    alteradas: 0,
    canceladas: 0,
    criadas: 0,
    reativadas: 0,
    cadenciaIds: [],
  };
  const entradaPipeline = input.evento === "CARD_CRIADO"
    || input.pipelineAnteriorId !== input.pipelineDestinoId;
  const entradaEtapa = entradaPipeline || input.etapaAnteriorId !== input.etapaDestinoId;
  if (!entradaEtapa) return resultado;

  const [destino, card] = await Promise.all([
    tx.bpmEtapa.findFirst({
      where: { id: input.etapaDestinoId, pipelineId: input.pipelineDestinoId, ativo: true },
      select: { id: true },
    }),
    tx.bpmCard.findFirst({
      where: {
        id: input.cardId,
        pipelineId: input.pipelineDestinoId,
        etapaId: input.etapaDestinoId,
        status: "ATIVO",
      },
      select: { id: true },
    }),
  ]);
  if (!destino) throw new Error("CADENCIA_DESTINO_INVALIDO");
  if (!card) return resultado;

  const escopos: Array<{ etapaId: string | null }> = [{ etapaId: input.etapaDestinoId }];
  if (entradaPipeline) escopos.push({ etapaId: null });
  const cadencias = await tx.bpmCadencia.findMany({
    where: {
      ativa: true,
      pipelineId: input.pipelineDestinoId,
      OR: escopos,
      passos: { some: { ativo: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      nome: true,
      passos: {
        where: { ativo: true },
        orderBy: { ordem: "asc" },
        take: 1,
        select: { ordem: true, intervaloDias: true },
      },
    },
  });
  if (cadencias.length === 0) return resultado;

  const existentes = await tx.bpmCardCadencia.findMany({
    where: { cardId: input.cardId, cadenciaId: { in: cadencias.map((cadencia) => cadencia.id) } },
    select: { id: true, cadenciaId: true, status: true },
  });
  const existentePorCadencia = new Map(existentes.map((vinculo) => [vinculo.cadenciaId, vinculo]));
  const agora = input.agora ?? new Date();

  for (const cadencia of cadencias) {
    const primeiroPasso = cadencia.passos[0];
    if (!primeiroPasso) continue;
    const existente = existentePorCadencia.get(cadencia.id);

    if (existente?.status === "ATIVA" || existente?.status === "CONCLUIDA" || existente?.status === "CANCELADA") {
      continue;
    }

    const proximaExecucaoEm = new Date(agora.getTime() + primeiroPasso.intervaloDias * DIA_MS);
    let acao: "CADENCIA_INICIADA" | "CADENCIA_REATIVADA";

    if (existente?.status === "PAUSADA") {
      const atualizado = await tx.bpmCardCadencia.updateMany({
        where: { id: existente.id, status: "PAUSADA" },
        data: {
          status: "ATIVA",
          passoAtualOrdem: primeiroPasso.ordem,
          proximaExecucaoEm,
          iniciadaEm: agora,
          concluidaEm: null,
          motivoInterrupcao: null,
        },
      });
      if (atualizado.count === 0) continue;
      resultado.reativadas++;
      acao = "CADENCIA_REATIVADA";
    } else {
      try {
        await tx.bpmCardCadencia.create({
          data: {
            cardId: input.cardId,
            cadenciaId: cadencia.id,
            status: "ATIVA",
            passoAtualOrdem: primeiroPasso.ordem,
            proximaExecucaoEm,
            iniciadaEm: agora,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
        throw error;
      }
      resultado.criadas++;
      acao = "CADENCIA_INICIADA";
    }

    resultado.cadenciaIds.push(cadencia.id);
    await registrarHistoricoCard({
      cardId: input.cardId,
      acao,
      usuarioId: input.usuarioId,
      automacaoOrigem: input.automacaoOrigem ?? "Ativação automática de cadência",
      valorNovoJson: JSON.stringify({
        cadenciaId: cadencia.id,
        nomeCadencia: cadencia.nome,
        ativacaoAutomatica: true,
        evento: input.evento,
        pipelineId: input.pipelineDestinoId,
        etapaId: input.etapaDestinoId,
        passoAtualOrdem: primeiroPasso.ordem,
      }),
    }, tx);
  }

  resultado.alteradas = resultado.criadas + resultado.reativadas;
  return resultado;
}

/** Compatibilidade para chamadores externos; fluxos de card usam a versão transacional. */
export async function sincronizarCadenciasNaEntradaBpm(
  input: EntradaCadenciaBpm,
): Promise<ResultadoAtivacaoCadenciasBpm> {
  const resultado = await db.$transaction((tx) => ativarCadenciasNaEntradaBpm(input, tx));
  if (resultado.alteradas > 0) {
    await notificarPipelineBpm({
      pipelineId: input.pipelineDestinoId,
      cardId: input.cardId,
      tipo: "TAREFA_ALTERADA",
    });
  }
  return resultado;
}

export async function validarEscopoCadenciaBpm(
  input: { pipelineId: string | null | undefined; etapaId?: string | null | undefined },
  tx: Pick<Tx, "bpmEtapa">,
): Promise<void> {
  if (!input.pipelineId) throw new Error("CADENCIA_PIPELINE_OBRIGATORIO");
  if (!input.etapaId) return;
  const etapa = await tx.bpmEtapa.findFirst({
    where: { id: input.etapaId, pipelineId: input.pipelineId, ativo: true },
    select: { id: true },
  });
  if (!etapa) throw new Error("CADENCIA_ETAPA_FORA_PIPELINE");
}
