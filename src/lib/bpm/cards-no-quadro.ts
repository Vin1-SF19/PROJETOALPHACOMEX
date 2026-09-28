import "server-only";

import db from "@/lib/prisma";
import { etapaEhNovosLeads } from "@/lib/bpm/novos-leads";
import { buscarNolossLeadsPendentes } from "@/lib/bpm/noloss-leads";
import { pipelineEhRevisaoRadar } from "@/lib/bpm/proximo-contato";
import { resolverVisibilidadeEtapa } from "@/lib/bpm/visibilidade-etapa";

type EtapaDoQuadro = {
  id: string;
  nome: string;
  ehFinal: boolean;
  visibilidades: { perfil: string; podeVer: boolean; podeAgir: boolean }[];
  automacoes: { versoes: { grafoJson: string }[] }[];
};

export function etapasComSaidaDoQuadro(etapas: readonly EtapaDoQuadro[]): Set<string> {
  return new Set(etapas.filter((etapa) => etapa.automacoes.some((automacao) =>
    automacao.versoes.some((versao) => {
      try {
        const grafo = JSON.parse(versao.grafoJson) as { nos?: { acaoTipo?: string }[] };
        return grafo.nos?.some((no) => no.acaoTipo === "CRIAR_CARD_OUTRO_PIPELINE") ?? false;
      } catch { return false; }
    }))).map((etapa) => etapa.id));
}

export function cardApareceNoQuadro(card: {
  status: string;
  etapaId: string;
  vinculosOrigem: readonly unknown[];
}, etapas: readonly EtapaDoQuadro[], etapasComSaida: ReadonlySet<string>): boolean {
  if (card.status === "ATIVO") return true;
  return card.status === "CONCLUIDO"
    && Boolean(etapas.find((etapa) => etapa.id === card.etapaId)?.ehFinal)
    && (card.vinculosOrigem.length > 0 || etapasComSaida.has(card.etapaId));
}

/** A mesma seleção de estados, etapas, membros e leads virtuais do Kanban. */
export async function contarCardsVisiveisNoQuadro(
  pipelineId: string,
  userId: number,
  role: string | null,
  admin: boolean,
): Promise<number> {
  const pipeline = await db.bpmPipeline.findUnique({
    where: { id: pipelineId },
    select: {
      nome: true,
      etapas: {
        where: { ativo: true },
        select: {
          id: true, nome: true, ehFinal: true,
          visibilidades: { select: { perfil: true, podeVer: true, podeAgir: true } },
          automacoes: { where: { ativa: true }, select: { versoes: {
            where: { status: "ATIVA" }, select: { grafoJson: true },
          } } },
        },
      },
    },
  });
  if (!pipeline) return 0;
  const etapasVisiveis = pipeline.etapas.filter((etapa) =>
    resolverVisibilidadeEtapa(role, etapa.visibilidades).podeVer);
  const etapaIdsVisiveis = etapasVisiveis.map((etapa) => etapa.id);
  const cards = etapaIdsVisiveis.length ? await db.bpmCard.findMany({
    where: {
      pipelineId,
      etapaId: { in: etapaIdsVisiveis },
      OR: [{ status: "ATIVO" }, { status: "CONCLUIDO", etapa: { ehFinal: true } }],
      ...(admin ? {} : { membros: { some: { userId } } }),
    },
    select: {
      status: true, etapaId: true,
      vinculosOrigem: {
        where: { cardDestino: { pipeline: { ativo: true }, status: { not: "ARQUIVADO" } } },
        select: { id: true }, take: 1,
      },
    },
  }) : [];
  const etapasComSaida = etapasComSaidaDoQuadro(pipeline.etapas);
  const reais = cards.filter((card) => cardApareceNoQuadro(card, pipeline.etapas, etapasComSaida)).length;
  const mostraNoloss = pipelineEhRevisaoRadar(pipeline.nome)
    && etapasVisiveis.some((etapa) => etapaEhNovosLeads(etapa.nome));
  const virtuais = mostraNoloss ? (await buscarNolossLeadsPendentes()).length : 0;
  return reais + virtuais;
}
