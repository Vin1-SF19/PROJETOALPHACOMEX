/**
 * Motor de Regras e Validações — guarda de movimentação (RM-2026-19631A,
 * Fase 2). Aplica as BpmRegra ativas escopadas ao pipeline/etapa antes de
 * uma transição de card, reaproveitando o mesmo avaliador puro da Fase 1.
 *
 * Fail-open deliberado: qualquer erro de avaliação (regra malformada, campo
 * fora do allowlist, exceção inesperada) é registrado no console e NÃO
 * bloqueia a movimentação — uma regra mal configurada por um admin não pode
 * travar o Alpha CRM inteiro. O admin corrige a regra a partir dos logs; o
 * comportamento nativo (guardas hardcoded já existentes) continua intacto.
 */
import type { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import { avaliarRegras } from "./avaliador";
import { carregarRegrasAplicaveis, montarContextoAvaliacaoDoCard } from "./contexto";

type CardParaGuardaRegras = Parameters<typeof montarContextoAvaliacaoDoCard>[0];

export async function obterErroRegrasParaMovimento(params: {
  card: CardParaGuardaRegras;
  etapaDestinoId: string;
  client?: Prisma.TransactionClient | typeof db;
}): Promise<string | null> {
  try {
    const client = params.client ?? db;
    const regras = await carregarRegrasAplicaveis({
      pipelineId: params.card.pipelineId,
      etapaOrigemId: params.card.etapaId,
      etapaDestinoId: params.etapaDestinoId,
      client,
    });
    if (regras.length === 0) return null;
    const contexto = await montarContextoAvaliacaoDoCard(params.card, client);
    const resultado = avaliarRegras(regras, contexto);
    return resultado.permitida ? null : (resultado.motivo ?? "Movimentação bloqueada por regra configurada.");
  } catch (error) {
    console.error("[bpm/regras] falha ao avaliar regras na movimentação — seguindo sem bloquear:", error);
    return null;
  }
}
