import db from "@/lib/prisma";

/**
 * Automações do BPM (D-034): implementadas em código, não configuráveis via UI.
 * Cada automação é uma função dedicada, chamada explicitamente no ponto do evento
 * que a dispara (ex.: MoverCardBpm chama verificarAutomacaoFechamentoComercial após
 * mover um card do pipeline Comercial).
 */

const NOME_PIPELINE_COMERCIAL = "Comercial";
const NOME_ETAPA_FECHADO_GANHO = "Fechado Ganho";
const NOME_PIPELINE_FINANCEIRO = "Financeiro";
const NOME_PIPELINE_RADAR = "Radar";

/**
 * D-009: ao fechar com sucesso uma oportunidade do Comercial, cria automaticamente
 * card(s) nos pipelines Financeiro e Radar, mantendo vínculo com o card de origem
 * e a empresa (D-027 — histórico cruzado via BpmCardVinculo).
 */
export async function executarAutomacaoFechamentoComercial(cardId: string, usuarioId: number) {
  const card = await db.bpmCard.findUnique({
    where: { id: cardId },
    include: { pipeline: true, etapa: true },
  });
  if (!card) return;
  if (card.pipeline.nome !== NOME_PIPELINE_COMERCIAL) return;
  if (card.etapa.nome !== NOME_ETAPA_FECHADO_GANHO) return;

  const [pipelineFinanceiro, pipelineRadar] = await Promise.all([
    db.bpmPipeline.findFirst({ where: { nome: NOME_PIPELINE_FINANCEIRO } }),
    db.bpmPipeline.findFirst({ where: { nome: NOME_PIPELINE_RADAR } }),
  ]);

  const pipelinesDestino = [pipelineFinanceiro, pipelineRadar].filter(
    (p): p is NonNullable<typeof p> => p !== null,
  );

  for (const pipelineDestino of pipelinesDestino) {
    const cardExistente = await db.bpmCard.findFirst({
      where: { empresaId: card.empresaId, pipelineId: pipelineDestino.id, status: "ATIVO" },
    });
    // D-005: no máximo 1 card ativo por vez por pipeline/empresa — não duplica se já existir.
    if (cardExistente) continue;

    const primeiraEtapa = await db.bpmEtapa.findFirst({
      where: { pipelineId: pipelineDestino.id, ativo: true },
      orderBy: { ordem: "asc" },
    });
    if (!primeiraEtapa) continue;

    await db.$transaction(async (tx) => {
      const novoCard = await tx.bpmCard.create({
        data: {
          empresaId: card.empresaId,
          pipelineId: pipelineDestino.id,
          etapaId: primeiraEtapa.id,
          responsavelId: card.responsavelId,
        },
      });

      await tx.bpmCardMembro.create({
        data: { cardId: novoCard.id, userId: card.responsavelId, role: "RESPONSAVEL" },
      });

      await tx.bpmCardVinculo.create({
        data: { cardOrigemId: card.id, cardDestinoId: novoCard.id },
      });

      await tx.bpmCardHistorico.create({
        data: {
          cardId: novoCard.id,
          acao: "CARD_CRIADO_POR_AUTOMACAO",
          automacaoOrigem: "fechamento_comercial",
          valorNovoJson: JSON.stringify({ cardOrigemId: card.id, pipelineOrigem: NOME_PIPELINE_COMERCIAL }),
        },
      });

      await tx.bpmCardHistorico.create({
        data: {
          cardId: card.id,
          acao: "AUTOMACAO_DISPAROU_CARD",
          usuarioId,
          automacaoOrigem: "fechamento_comercial",
          valorNovoJson: JSON.stringify({ cardDestinoId: novoCard.id, pipelineDestino: pipelineDestino.nome }),
        },
      });
    });
  }
}
