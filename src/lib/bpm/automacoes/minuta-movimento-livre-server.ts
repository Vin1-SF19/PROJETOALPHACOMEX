import "server-only";

import type { BpmAutomacaoVersao, BpmEventoDominio, Prisma } from "@prisma/client";
import { checarAcessoBpmCard } from "@/lib/bpm/ownership";
import { montarContextoAvaliacaoDoCard } from "@/lib/bpm/regras/contexto";
import { avaliarGrupo } from "@/lib/bpm/regras/avaliador";
import { grupoCondicaoSchema } from "@/lib/bpm/regras/schemas";
import { gatilhoConfigSchema } from "./central-schemas";
import { grafoEhMinutaConfigurada, objetoEventoMinuta } from "./minuta-movimento-livre";

type EventoMinuta = Pick<BpmEventoDominio, "tipo" | "entidadeTipo" | "entidadeId" | "cardId" | "pipelineId" | "atorTipo" | "atorUserId" | "atorExecucaoId" | "valorNovoJson" | "valorAnteriorJson" | "profundidade" | "causationId" | "idempotencyKey">;
type VersaoMinuta = Pick<BpmAutomacaoVersao, "status" | "gatilhoTipo" | "gatilhoConfigJson" | "grafoJson" | "condicaoJson"> & {
  automacao: { ativa: boolean; pipelineId: string; etapaId: string };
};

/** Revalida a autorização vigente em cada fronteira; o marcador sozinho não autoriza. */
export async function motivoBloqueioMinutaMovimentoLivre(
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
    || novo.automacoesSuprimidas !== true || novo.permitirMinutaConfigurada !== true
    || !autoridade || typeof autoridade !== "object" || !("tipo" in autoridade)
    || (autoridade.tipo !== "ADMIN" && autoridade.tipo !== "ADMIN_PIPELINE")) return "MOVIMENTO_LIVRE_SEM_AUTORIZACAO_DOCUMENTAL";
  if (!versao.automacao.ativa || versao.status !== "ATIVA" || versao.gatilhoTipo !== "ENTRAR_COLUNA") return "REGRA_DOCUMENTAL_INATIVA";
  if (!evento.causationId || !evento.idempotencyKey.startsWith("transition:")) return "ORIGEM_DOCUMENTAL_NAO_COMPROVADA";
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
    || autoridadeHistorico.setor !== autoridade.setor) return "ORIGEM_DOCUMENTAL_NAO_COMPROVADA";
  let config: ReturnType<typeof gatilhoConfigSchema.parse>;
  try {
    if (!grafoEhMinutaConfigurada(JSON.parse(versao.grafoJson))) return "GRAFO_NAO_DOCUMENTAL";
    config = gatilhoConfigSchema.parse(JSON.parse(versao.gatilhoConfigJson));
  } catch { return "CONFIGURACAO_DOCUMENTAL_INVALIDA"; }
  const etapas = [...(config.etapasIds ?? []), ...(config.etapaId ? [config.etapaId] : [])];
  if (evento.pipelineId !== versao.automacao.pipelineId || novo.etapaId !== versao.automacao.etapaId
    || (config.escopo !== "GLOBAL_PIPELINE" && etapas.length && !etapas.includes(versao.automacao.etapaId))) return "DESTINO_DOCUMENTAL_DIVERGENTE";
  const card = await client.bpmCard.findUnique({
    where: { id: evento.cardId },
    select: {
      id: true, empresaId: true, pipelineId: true, etapaId: true, status: true,
      responsavelId: true, servico: true, tipoProcesso: true, createdAt: true, updatedAt: true,
      concluidoEm: true, primeiraVisualizacaoEm: true, proximoContatoEm: true, dataReuniao: true, statusPosFechamento: true,
      pipeline: { select: { ativo: true } }, etapa: { select: { ativo: true, pipelineId: true } },
    },
  });
  if (!card || !["ATIVO", "CONCLUIDO"].includes(card.status) || !card.pipeline.ativo || !card.etapa.ativo
    || card.pipelineId !== evento.pipelineId || card.etapaId !== novo.etapaId
    || card.etapa.pipelineId !== card.pipelineId) return "CARD_FORA_DO_CONTEXTO_DOCUMENTAL";
  const acesso = await checarAcessoBpmCard(card.id, evento.atorUserId!, null, "moverEtapa", client);
  if (!acesso.autorizado || !acesso.autoridadeMovimentoLivre) return "AUTORIDADE_MOVIMENTO_LIVRE_REVOGADA";
  if (versao.condicaoJson) {
    const condicao = grupoCondicaoSchema.parse(JSON.parse(versao.condicaoJson));
    if (!avaliarGrupo(condicao, await montarContextoAvaliacaoDoCard(card, client))) return "CONDICAO_NAO_ATENDIDA";
  }
  return null;
}
