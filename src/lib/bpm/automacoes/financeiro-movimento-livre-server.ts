import "server-only";

import type { BpmAutomacaoVersao, BpmEventoDominio, Prisma } from "@prisma/client";
import { checarAcessoBpmCard } from "@/lib/bpm/ownership";
import { montarContextoAvaliacaoDoCard } from "@/lib/bpm/regras/contexto";
import { avaliarGrupo } from "@/lib/bpm/regras/avaliador";
import { grupoCondicaoSchema } from "@/lib/bpm/regras/schemas";
import { gatilhoConfigSchema } from "./central-schemas";
import { objetoEventoMinuta } from "./minuta-movimento-livre";
import { ehFechamentoComercialLivre, parametrosFinanceiroMovimentoLivre } from "./financeiro-movimento-livre";

type EventoMinuta = Pick<BpmEventoDominio, "tipo" | "entidadeTipo" | "entidadeId" | "cardId" | "pipelineId" | "atorTipo" | "atorUserId" | "atorExecucaoId" | "valorNovoJson" | "valorAnteriorJson" | "profundidade" | "causationId" | "idempotencyKey">;
type VersaoMinuta = Pick<BpmAutomacaoVersao, "status" | "gatilhoTipo" | "gatilhoConfigJson" | "grafoJson" | "condicaoJson"> & {
  automacao: { ativa: boolean; pipelineId: string; etapaId: string };
};

/** Revalida a autorização vigente em cada fronteira; o marcador sozinho não autoriza. */
export async function motivoBloqueioFinanceiroMovimentoLivre(
  evento: EventoMinuta,
  versao: VersaoMinuta,
  client: Prisma.TransactionClient,
): Promise<string | null> {
  const novo = objetoEventoMinuta(evento.valorNovoJson);
  const autoridade = novo.movimentoLivre;
  if (evento.tipo !== "CARD_MOVIDO" || evento.entidadeTipo !== "CARD"
    || !evento.cardId || evento.entidadeId !== evento.cardId
    || evento.atorTipo !== "USUARIO" || !Number.isInteger(evento.atorUserId) || !evento.atorUserId
    || evento.atorExecucaoId !== null || evento.profundidade !== 0
    || novo.automacoesSuprimidas !== true || novo.permitirEncaminhamentoFinanceiroConfigurado !== true
    || !autoridade || typeof autoridade !== "object" || !("tipo" in autoridade)
    || (autoridade.tipo !== "ADMIN" && autoridade.tipo !== "LIDER_SETOR")) return "MOVIMENTO_LIVRE_SEM_AUTORIZACAO_FINANCEIRO";
  if (!versao.automacao.ativa || versao.status !== "ATIVA" || versao.gatilhoTipo !== "ENTRAR_COLUNA") return "REGRA_FINANCEIRO_INATIVA";
  if (!evento.causationId || !evento.idempotencyKey.startsWith("transition:")) return "ORIGEM_FINANCEIRO_NAO_COMPROVADA";
  const historico = await client.bpmCardHistorico.findFirst({
    where: { id: evento.causationId, cardId: evento.cardId, acao: "CARD_MOVIDO", usuarioId: evento.atorUserId },
    select: { valorAnteriorJson: true, valorNovoJson: true },
  });
  const anterior = objetoEventoMinuta(evento.valorAnteriorJson);
  const anteriorHistorico = objetoEventoMinuta(historico?.valorAnteriorJson ?? null);
  const novoHistorico = objetoEventoMinuta(historico?.valorNovoJson ?? null);
  const autoridadeHistorico = novoHistorico.movimentoLivre;
  if (!historico || typeof novo.versao !== "number" || !Number.isInteger(novo.versao) || novo.versao < 1
    || anterior.versao !== novo.versao - 1 || anteriorHistorico.versao !== anterior.versao
    || novoHistorico.versao !== novo.versao || typeof anterior.etapaId !== "string"
    || anteriorHistorico.etapaId !== anterior.etapaId || novoHistorico.etapaId !== novo.etapaId
    || !autoridadeHistorico || typeof autoridadeHistorico !== "object" || !("tipo" in autoridadeHistorico)
    || autoridadeHistorico.tipo !== autoridade.tipo || !("setor" in autoridadeHistorico) || !("setor" in autoridade)
    || autoridadeHistorico.setor !== autoridade.setor) return "ORIGEM_FINANCEIRO_NAO_COMPROVADA";
  if (novoHistorico.permitirEncaminhamentoFinanceiroConfigurado !== true) return "ORIGEM_FINANCEIRO_NAO_COMPROVADA";
  let config: ReturnType<typeof gatilhoConfigSchema.parse>;
  let parametros: ReturnType<typeof parametrosFinanceiroMovimentoLivre>;
  try {
    parametros = parametrosFinanceiroMovimentoLivre(JSON.parse(versao.grafoJson));
    if (!parametros) return "GRAFO_NAO_FINANCEIRO";
    config = gatilhoConfigSchema.parse(JSON.parse(versao.gatilhoConfigJson));
  } catch { return "CONFIGURACAO_FINANCEIRO_INVALIDA"; }
  const etapas = [...(config.etapasIds ?? []), ...(config.etapaId ? [config.etapaId] : [])];
  if (evento.pipelineId !== versao.automacao.pipelineId || novo.etapaId !== versao.automacao.etapaId
    || (config.escopo !== "GLOBAL_PIPELINE" && etapas.length && !etapas.includes(versao.automacao.etapaId))) return "DESTINO_FINANCEIRO_DIVERGENTE";
  const card = await client.bpmCard.findUnique({
    where: { id: evento.cardId },
    select: {
      id: true, empresaId: true, pipelineId: true, etapaId: true, status: true,
      responsavelId: true, servico: true, tipoProcesso: true, createdAt: true, updatedAt: true,
      concluidoEm: true, primeiraVisualizacaoEm: true, proximoContatoEm: true, dataReuniao: true, statusPosFechamento: true,
      pipeline: { select: { ativo: true, nome: true, chave: true } }, etapa: { select: { ativo: true, pipelineId: true, nome: true, chave: true } },
    },
  });
  if (!card || !["ATIVO", "CONCLUIDO"].includes(card.status) || !card.pipeline.ativo || !card.etapa.ativo
    || card.pipelineId !== evento.pipelineId || card.etapaId !== novo.etapaId
    || card.etapa.pipelineId !== card.pipelineId) return "CARD_FORA_DO_CONTEXTO_FINANCEIRO";
  if (!ehFechamentoComercialLivre(card.pipeline, card.etapa)) return "CARD_FORA_DO_FECHAMENTO_COMERCIAL";
  const destino = await client.bpmEtapa.findFirst({
    where: { id: parametros.etapaId, pipelineId: parametros.pipelineId, ativo: true, pipeline: { ativo: true, chave: "financeiro" } },
    select: { id: true },
  });
  if (!destino) return "DESTINO_FINANCEIRO_INDISPONIVEL";
  const acesso = await checarAcessoBpmCard(card.id, evento.atorUserId!, null, "moverEtapa", client);
  if (!acesso.autorizado || !acesso.autoridadeMovimentoLivre) return "AUTORIDADE_MOVIMENTO_LIVRE_REVOGADA";
  if (versao.condicaoJson) {
    const condicao = grupoCondicaoSchema.parse(JSON.parse(versao.condicaoJson));
    if (!avaliarGrupo(condicao, await montarContextoAvaliacaoDoCard(card, client))) return "CONDICAO_NAO_ATENDIDA";
  }
  return null;
}
