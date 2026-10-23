import "server-only";
import type { Prisma } from "@prisma/client";
import { montarContextoAvaliacaoDoCard } from "@/lib/bpm/regras/contexto";
import { avaliarGrupo } from "@/lib/bpm/regras/avaliador";
import { grupoCondicaoSchema } from "@/lib/bpm/regras/schemas";
import { gatilhoConfigSchema } from "./central-schemas";
import { parametrosEncaminhamentoSchema } from "./schemas";
import { ehFechamentoComercialLivre, parametrosFinanceiroMovimentoLivre } from "./financeiro-movimento-livre";

/** Recuperação pontual pela sessão atual; nunca transforma o evento histórico. */
export async function validarRecuperacaoFinanceiraAtual(tx: Prisma.TransactionClient, cardId: string, automacaoId: string, parametros: ReturnType<typeof parametrosEncaminhamentoSchema.parse>) {
  const card = await tx.bpmCard.findUnique({ where: { id: cardId }, include: { pipeline: true, etapa: true } });
  if (!card || !["ATIVO", "CONCLUIDO"].includes(card.status) || !card.pipeline.ativo || !card.etapa.ativo
    || card.etapa.pipelineId !== card.pipelineId || !ehFechamentoComercialLivre(card.pipeline, card.etapa)) throw new Error("Recuperação disponível somente no fechamento comercial.");
  const versao = await tx.bpmAutomacaoVersao.findFirst({ where: { automacaoId, status: "ATIVA", gatilhoTipo: "ENTRAR_COLUNA",
    automacao: { ativa: true, pipelineId: card.pipelineId, etapaId: card.etapaId, acaoTipo: "CRIAR_CARD_OUTRO_PIPELINE" } }, orderBy: { versao: "desc" } });
  if (!versao) throw new Error("Regra automática de envio ao Financeiro indisponível.");
  const configurados = parametrosFinanceiroMovimentoLivre(JSON.parse(versao.grafoJson));
  if (!configurados || JSON.stringify(configurados) !== JSON.stringify(parametros)) throw new Error("A configuração do envio mudou. Atualize o card e solicite um novo encaminhamento.");
  const config = gatilhoConfigSchema.parse(JSON.parse(versao.gatilhoConfigJson));
  const etapas = [...(config.etapasIds ?? []), ...(config.etapaId ? [config.etapaId] : [])];
  if (config.escopo !== "GLOBAL_PIPELINE" && etapas.length && !etapas.includes(card.etapaId)) throw new Error("Regra automática de envio ao Financeiro indisponível.");
  if (!await tx.bpmEtapa.findFirst({ where: { id: parametros.etapaId, pipelineId: parametros.pipelineId, ativo: true,
    pipeline: { ativo: true, chave: "financeiro" } }, select: { id: true } })) throw new Error("Pipeline/etapa de destino inválidos");
  if (versao.condicaoJson && !avaliarGrupo(grupoCondicaoSchema.parse(JSON.parse(versao.condicaoJson)), await montarContextoAvaliacaoDoCard(card, tx))) {
    throw new Error("As condições do envio automático ao Financeiro não foram atendidas.");
  }
}
