/**
 * Motor de Regras e Validações — ponte entre a persistência (BpmRegra/
 * BpmRegraVersao) e o núcleo puro determinístico da Fase 1.
 * RM-2026-19631A, Fase 2.
 */
import type { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import type { ContextoAvaliacao, RegraBpm } from "./types";
import { regraBpmSchema } from "./schemas";
import { carregarResumoChecklistAplicavelSeguro } from "@/lib/bpm/checklists/integracao";

type CardParaContexto = {
  id: string;
  pipelineId: string;
  etapaId: string;
  responsavelId: number;
  servico: string | null;
  tipoProcesso?: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  concluidoEm: Date | null;
  primeiraVisualizacaoEm: Date | null;
  proximoContatoEm: Date | null;
  dataReuniao: Date | null;
  statusPosFechamento: string | null;
  empresaId: number;
};

function dataOuNulo(valor: Date | null): string | null {
  return valor ? valor.toISOString() : null;
}

/**
 * Monta o contexto de avaliação a partir de um card já carregado — não busca
 * o card de novo para reaproveitar exatamente a leitura (dentro ou fora de
 * transação) já feita pelo chamador em executarMovimentoComRequisitos.
 */
export async function montarContextoAvaliacaoDoCard(
  card: CardParaContexto,
  client: Prisma.TransactionClient | typeof db = db,
): Promise<ContextoAvaliacao> {
  const [cliente, valoresCampos, checklist] = await Promise.all([
    client.cliente.findUnique({
      where: { id: card.empresaId },
      select: {
        id: true,
        cnpj: true,
        razaoSocial: true,
        nomeFantasia: true,
        dataConstituicao: true,
        uf: true,
        municipio: true,
        regimeTributario: true,
        capitalSocial: true,
        situacaoCadastral: true,
        status: true,
      },
    }),
    client.bpmCardCampoValor.findMany({
      where: { cardId: card.id },
      select: { campoId: true, valor: true },
    }),
    carregarResumoChecklistAplicavelSeguro({
      id: card.id,
      pipelineId: card.pipelineId,
      etapaId: card.etapaId,
      servico: card.servico,
      tipoProcesso: card.tipoProcesso ?? null,
    }, client),
  ]);
  const camposDinamicos = Object.fromEntries(
    valoresCampos.map((item) => [item.campoId, item.valor]),
  );

  return {
    card: {
      id: card.id,
      pipelineId: card.pipelineId,
      etapaId: card.etapaId,
      responsavelId: card.responsavelId,
      servico: card.servico,
      status: card.status,
      createdAt: card.createdAt.toISOString(),
      updatedAt: card.updatedAt.toISOString(),
      concluidoEm: dataOuNulo(card.concluidoEm),
      primeiraVisualizacaoEm: dataOuNulo(card.primeiraVisualizacaoEm),
      proximoContatoEm: dataOuNulo(card.proximoContatoEm),
      dataReuniao: dataOuNulo(card.dataReuniao),
      statusPosFechamento: card.statusPosFechamento,
    },
    cliente: cliente ?? undefined,
    checklist: {
      total: checklist.total,
      concluidos: checklist.concluidos,
      percentual: checklist.percentual,
      concluido: checklist.concluido,
      pendentesObrigatorios: checklist.pendentesObrigatorios,
      possuiPendenciaObrigatoria: checklist.possuiPendenciaObrigatoria,
    },
    camposDinamicos,
  };
}

/**
 * Carrega as regras ativas aplicáveis a uma transição de etapa: escopadas ao
 * pipeline do card (ou globais, sem pipelineId) e, quando etapasJson estiver
 * preenchido, apenas as que citam a etapa de origem ou destino da
 * movimentação — uma regra sem etapasJson vale para qualquer etapa do
 * pipeline.
 */
export async function carregarRegrasAplicaveis(params: {
  pipelineId: string;
  etapaOrigemId: string;
  etapaDestinoId: string;
  client?: Prisma.TransactionClient | typeof db;
}): Promise<RegraBpm[]> {
  const client = params.client ?? db;
  const linhas = await client.bpmRegra.findMany({
    where: {
      ativa: true,
      OR: [{ pipelineId: params.pipelineId }, { pipelineId: null }],
    },
    select: {
      id: true,
      nome: true,
      ativa: true,
      prioridade: true,
      pipelineId: true,
      etapasJson: true,
      versaoAtualNum: true,
      versoes: { select: { versao: true, condicaoJson: true, resultadoJson: true } },
    },
  });

  const regras: RegraBpm[] = [];
  for (const linha of linhas) {
    if (linha.etapasJson) {
      let etapasAplicaveis: unknown;
      try {
        etapasAplicaveis = JSON.parse(linha.etapasJson);
      } catch {
        continue;
      }
      const lista = Array.isArray(etapasAplicaveis) ? etapasAplicaveis : [];
      const aplica = lista.includes(params.etapaOrigemId) || lista.includes(params.etapaDestinoId);
      if (!aplica) continue;
    }
    const versao = linha.versoes.find((item) => item.versao === linha.versaoAtualNum);
    if (!versao) continue;
    let condicao: unknown;
    let resultado: unknown;
    try {
      condicao = JSON.parse(versao.condicaoJson);
      resultado = JSON.parse(versao.resultadoJson);
    } catch {
      continue;
    }
    const validada = regraBpmSchema.safeParse({
      id: linha.id,
      versao: versao.versao,
      nome: linha.nome,
      ativa: linha.ativa,
      prioridade: linha.prioridade,
      pipelineId: linha.pipelineId ?? undefined,
      condicao,
      resultado,
    });
    if (validada.success) regras.push(validada.data);
  }
  return regras;
}
