import db from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { registrarHistoricoCard } from "@/lib/bpm/historico-server";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";
import { chaveExecucaoCicloCadencia } from "@/lib/bpm/cadencias/ativacao-automatica";

/**
 * Processa cadências vencidas: encontra vínculos ATIVOS com proximaExecucaoEm <= agora,
 * avança o passo atual, cria BpmTarefa e registra histórico.
 *
 * Idempotência: a chave única (vinculoId, passoId, chaveEvento) em BpmCadenciaPassoExecucao
 * impede execução duplicada mesmo sob concorrência.
 *
 * Atomicidade: cada vínculo é processado dentro de db.$transaction — se qualquer
 * passo intermediário falhar, a execução é marcada como FALHA (não fica EM_EXECUCAO órfã).
 *
 * Invocado por:
 * - Cron existente (src/app/api/bpm/jobs/automacoes/route.ts)
 * - CLI: npm run bpm:cadencias
 */
export async function processarCadenciasBpm(): Promise<{
  processadas: number;
  falhas: number;
  avisos: string[];
}> {
  const agora = new Date();
  const avisos: string[] = [];

  // 1. Encontrar vínculos ATIVOS com próxima execução vencida
  const vinculosVencidos = await db.bpmCardCadencia.findMany({
    where: {
      status: "ATIVA",
      proximaExecucaoEm: { lte: agora },
      cadencia: { ativa: true },
    },
    include: {
      cadencia: {
        include: {
          passos: {
            where: { ativo: true },
            orderBy: { ordem: "asc" },
          },
        },
      },
      card: {
        select: { id: true, pipelineId: true, etapaId: true, status: true, responsavelId: true },
      },
    },
    take: 100, // limite por execução para não sobrecarregar
  });

  let processadas = 0;
  let falhas = 0;

  for (const vinculo of vinculosVencidos) {
    try {
      // 2. Validar que o card ainda está ATIVO
      if (vinculo.card.status !== "ATIVO") {
        await db.bpmCardCadencia.update({
          where: { id: vinculo.id },
          data: { status: "CANCELADA", motivoInterrupcao: "Card não está mais ATIVO" },
        });
        avisos.push(`Vínculo ${vinculo.id} cancelado: card não ATIVO`);
        continue;
      }

      // Encontrar o passo atual.
      const passoAtual = vinculo.cadencia.passos.find(
        (p) => p.ordem === vinculo.passoAtualOrdem
      );

      if (!passoAtual) {
        // Passo não encontrado (pode ter sido desativado) — avançar para o próximo ativo
        const proximoPasso = vinculo.cadencia.passos.find(
          (p) => p.ordem > vinculo.passoAtualOrdem
        );
        if (proximoPasso) {
          await db.bpmCardCadencia.update({
            where: { id: vinculo.id },
            data: {
              passoAtualOrdem: proximoPasso.ordem,
              proximaExecucaoEm: new Date(agora.getTime() + proximoPasso.intervaloDias * 86400000),
            },
          });
        } else {
          // Último passo — concluir
          await db.bpmCardCadencia.update({
            where: { id: vinculo.id },
            data: { status: "CONCLUIDA", concluidaEm: agora },
          });
          await registrarHistoricoCard({
            cardId: vinculo.cardId,
            acao: "CADENCIA_CONCLUIDA",
            valorNovoJson: JSON.stringify({ cadenciaId: vinculo.cadenciaId, nomeCadencia: vinculo.cadencia.nome }),
            automacaoOrigem: "Motor de Cadências",
          });
        }
        processadas++;
        continue;
      }

      // 6. A identidade inclui o início do ciclo: reentrar na etapa cria um
      // novo ciclo, enquanto concorrentes do mesmo ciclo continuam idempotentes.
      const chaveEvento = chaveExecucaoCicloCadencia({
        vinculoId: vinculo.id,
        passoId: passoAtual.id,
        iniciadaEm: vinculo.iniciadaEm,
        createdAt: vinculo.createdAt,
      });

      // 7-11. Processar dentro de transação atômica:
      //   criar execução → criar tarefa → concluir execução → avançar vínculo → histórico
      let concluido = false;

      await db.$transaction(async (tx) => {
        // Revalida dentro da transação para não gerar tarefa se o card mudou
        // entre a leitura do lote e o processamento deste vínculo.
        const [cardAtual, cadenciaAtual] = await Promise.all([
          tx.bpmCard.findUnique({
            where: { id: vinculo.cardId },
            select: { pipelineId: true, etapaId: true, status: true },
          }),
          tx.bpmCadencia.findUnique({
            where: { id: vinculo.cadenciaId },
            select: { pipelineId: true, etapaId: true, ativa: true },
          }),
        ]);
        if (!cardAtual || cardAtual.status !== "ATIVO") throw new Error("CADENCIA_CARD_INATIVO");
        if (!cadenciaAtual?.ativa) throw new Error("CADENCIA_DEFINICAO_INATIVA");

        // Tentar criar execução (idempotente via unique constraint)
        let execucao;
        try {
          execucao = await tx.bpmCadenciaPassoExecucao.create({
            data: {
              vinculoId: vinculo.id,
              passoId: passoAtual.id,
              chaveEvento,
              status: "EM_EXECUCAO",
              disponivelEm: agora,
            },
          });
        } catch (e: unknown) {
          // Unique constraint violation (P2002) = já processado (idempotência)
          const p2002Tipado = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
          const p2002Compatibilidade = typeof e === "object" && e !== null && "code" in e && (e as { code?: unknown }).code === "P2002";
          if (p2002Tipado || p2002Compatibilidade) {
            throw new Error("IDEMPOTENTE");
          }
          throw e;
        }

        // 7. Criar BpmTarefa para o card
        const prazo = passoAtual.prazoRelativoDias
          ? new Date(agora.getTime() + passoAtual.prazoRelativoDias * 86400000)
          : null;

        const alertaEm = passoAtual.alertaAntecedenciaHoras
          ? new Date((prazo ?? agora).getTime() - passoAtual.alertaAntecedenciaHoras * 3600000)
          : null;

        const tarefa = await tx.bpmTarefa.create({
          data: {
            cardId: vinculo.cardId,
            titulo: passoAtual.titulo,
            descricao: passoAtual.descricao,
            responsavelId: passoAtual.responsavelId ?? vinculo.card.responsavelId,
            prazo,
            tipo: passoAtual.tipoTarefa,
            alertaEm,
            prioridade: passoAtual.prioridade,
            status: "PENDENTE",
            checklistJson: passoAtual.checklistJson,
            cadenciaExecucaoId: execucao.id,
          },
        });
        // 8. Concluir a execução
        await tx.bpmCadenciaPassoExecucao.update({
          where: { id: execucao.id },
          data: { status: "CONCLUIDA", executadaEm: agora },
        });

        // 9. Avançar para o próximo passo ou concluir
        const proximoPasso = vinculo.cadencia.passos.find(
          (p) => p.ordem > passoAtual.ordem && p.ativo
        );

        if (proximoPasso) {
          const proximaExecucao = new Date(agora.getTime() + proximoPasso.intervaloDias * 86400000);
          await tx.bpmCardCadencia.update({
            where: { id: vinculo.id },
            data: {
              passoAtualOrdem: proximoPasso.ordem,
              proximaExecucaoEm: proximaExecucao,
            },
          });
        } else {
          await tx.bpmCardCadencia.update({
            where: { id: vinculo.id },
            data: { status: "CONCLUIDA", concluidaEm: agora },
          });
          concluido = true;
        }

        // 10. Registrar histórico
        await registrarHistoricoCard(
          {
            cardId: vinculo.cardId,
            acao: concluido ? "CADENCIA_CONCLUIDA" : "CADENCIA_PASSO_EXECUTADO",
            valorNovoJson: JSON.stringify({
              cadenciaId: vinculo.cadenciaId,
              nomeCadencia: vinculo.cadencia.nome,
              passoOrdem: passoAtual.ordem,
              passoTitulo: passoAtual.titulo,
              tarefaId: tarefa.id,
            }),
            automacaoOrigem: "Motor de Cadências",
          },
          tx,
        );
      });

      // 11. Notificar em tempo real (fora da transação — não bloqueia commit)
      await notificarPipelineBpm({ pipelineId: vinculo.card.pipelineId, tipo: "TAREFA_ALTERADA" });

      processadas++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);

      // Idempotência: já processado neste ciclo
      if (msg === "IDEMPOTENTE") {
        avisos.push(`Execução duplicada ignorada (idempotente): vínculo ${vinculo.id}`);
        processadas++;
        continue;
      }

      if (msg === "CADENCIA_DEFINICAO_INATIVA") {
        avisos.push(`Vínculo ${vinculo.id} ignorado: definição inativa revalidada`);
        continue;
      }
      if (msg === "CADENCIA_CARD_INATIVO") {
        await db.bpmCardCadencia.update({
          where: { id: vinculo.id },
          data: { status: "CANCELADA", motivoInterrupcao: "Card não está mais ATIVO", concluidaEm: agora, proximaExecucaoEm: null },
        });
        avisos.push(`Vínculo ${vinculo.id} cancelado: card não ATIVO revalidado`);
        continue;
      }

      // Recuperação de falha: marcar qualquer execução EM_EXECUCAO como FALHA
      try {
        await db.bpmCadenciaPassoExecucao.updateMany({
          where: { vinculoId: vinculo.id, status: "EM_EXECUCAO" },
          data: { status: "FALHA", erro: msg.slice(0, 500) },
        });
      } catch {
        // best-effort cleanup — não impede o reporte da falha
      }

      falhas++;
      avisos.push(`Falha ao processar vínculo ${vinculo.id}: ${msg}`);
    }
  }

  return { processadas, falhas, avisos };
}
