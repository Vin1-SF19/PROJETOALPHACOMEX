import { carregarEscopoLeituraBpm } from "@/lib/bpm/visao-equipe-server";
import "server-only";

import db from "@/lib/prisma";
import { etapaEhNovosLeads } from "@/lib/bpm/novos-leads";
import { buscarNolossLeadsPendentes } from "@/lib/bpm/noloss-leads";
import { buscarInstagramLeadsPendentes } from "@/lib/bpm/instagram-leads-server";
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
export async function contarCardsVisiveisPorEtapaNoQuadro(
  pipelineId: string,
  userId: number,
  role: string | null,
  admin: boolean,
): Promise<{ etapaId: string; quantidade: number }[]> {
  const pipeline = await db.bpmPipeline.findUnique({
    where: { id: pipelineId },
    select: {
      nome: true,
      visualizacaoConfigJson: true,
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
  if (!pipeline) return [];
  const etapasVisiveis = pipeline.etapas.filter((etapa) =>
    resolverVisibilidadeEtapa(role, etapa.visibilidades).podeVer);
  const etapaIdsVisiveis = etapasVisiveis.map((etapa) => etapa.id);
  const escopo = await carregarEscopoLeituraBpm(userId, admin, pipelineId, pipeline.visualizacaoConfigJson ?? null);
  const cards = etapaIdsVisiveis.length ? await db.bpmCard.findMany({
    where: {
      pipelineId,
      etapaId: { in: etapaIdsVisiveis },
      OR: [{ status: "ATIVO" }, { status: "CONCLUIDO", etapa: { ehFinal: true } }],
      ...escopo.where,
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
  const contagens = new Map(etapasVisiveis.map((etapa) => [etapa.id, 0]));
  for (const card of cards) {
    if (!cardApareceNoQuadro(card, pipeline.etapas, etapasComSaida)) continue;
    contagens.set(card.etapaId, (contagens.get(card.etapaId) ?? 0) + 1);
  }
  const mostraNoloss = pipelineEhRevisaoRadar(pipeline.nome)
    && etapasVisiveis.some((etapa) => etapaEhNovosLeads(etapa.nome));
  const virtuais = mostraNoloss
    ? (await buscarNolossLeadsPendentes()).length + (await buscarInstagramLeadsPendentes(pipelineId)).length
    : 0;
  const etapaNovosLeads = etapasVisiveis.find((etapa) => etapaEhNovosLeads(etapa.nome));
  if (etapaNovosLeads) contagens.set(etapaNovosLeads.id, (contagens.get(etapaNovosLeads.id) ?? 0) + virtuais);
  return [...contagens].map(([etapaId, quantidade]) => ({ etapaId, quantidade }));
}

export async function contarCardsVisiveisNoQuadro(
  pipelineId: string,
  userId: number,
  role: string | null,
  admin: boolean,
): Promise<number> {
  const contagens = await contarCardsVisiveisPorEtapaNoQuadro(pipelineId, userId, role, admin);
  return contagens.reduce((total, etapa) => total + etapa.quantidade, 0);
}
