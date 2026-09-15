import db from "@/lib/prisma";

import { LIMITE_AGENDA_DESATUALIZADA_MS } from "./health";
import { lerAgendaAlphaRuntimeConfig } from "./runtime-config";
import { obterResumoFila } from "./sync-queue";

export interface RelatorioSaudeAgendaAlpha {
  ok: boolean;
  timestamp: string;
  runtime: ReturnType<typeof lerAgendaAlphaRuntimeConfig>;
  conexoes: { ativas: number; semAgendas: number };
  calendarios: {
    total: number;
    desatualizados: number;
    nuncaSincronizados: number;
    semCanalAtivo: number;
  };
  canais: { ativos: number; comErro: number; expirandoEm24h: number };
  fila: Awaited<ReturnType<typeof obterResumoFila>>;
  filaAtrasada: number;
  alertas: string[];
}

/** Diagnóstico agregado e seguro: não retorna e-mail, conteúdo ou IDs de agenda. */
export async function obterRelatorioSaudeAgendaAlpha(
  agora = new Date(),
): Promise<RelatorioSaudeAgendaAlpha> {
  const runtime = lerAgendaAlphaRuntimeConfig();
  const staleBefore = new Date(agora.getTime() - LIMITE_AGENDA_DESATUALIZADA_MS);
  const filaParadaAntesDe = new Date(agora.getTime() - 10 * 60 * 1_000);
  const em24h = new Date(agora.getTime() + 24 * 60 * 60 * 1_000);
  const [ativas, semAgendas, total, desatualizados, nuncaSincronizados, semCanalAtivo, canaisAtivos, canaisComErro, expirandoEm24h, fila, filaAtrasada] =
    await Promise.all([
      db.googleCalendarConexao.count({ where: { status: "ATIVA" } }),
      db.googleCalendarConexao.count({
        where: { status: "ATIVA", calendarios: { none: { visivel: true } } },
      }),
      db.googleCalendarSelecionado.count({
        where: { visivel: true, conexao: { status: "ATIVA" } },
      }),
      db.googleCalendarSelecionado.count({
        where: {
          visivel: true,
          conexao: { status: "ATIVA" },
          OR: [
            { ultimaSincronizacaoEm: null },
            { ultimaSincronizacaoEm: { lte: staleBefore } },
          ],
        },
      }),
      db.googleCalendarSelecionado.count({
        where: { visivel: true, conexao: { status: "ATIVA" }, syncToken: null },
      }),
      db.googleCalendarSelecionado.count({
        where: {
          visivel: true,
          conexao: { status: "ATIVA" },
          pushChannels: {
            none: { status: "ACTIVE", expiresAt: { gt: agora } },
          },
        },
      }),
      db.googleCalendarPushChannel.count({
        where: { status: "ACTIVE", expiresAt: { gt: agora } },
      }),
      db.googleCalendarPushChannel.count({ where: { status: "ERROR" } }),
      db.googleCalendarPushChannel.count({
        where: { status: "ACTIVE", expiresAt: { lte: em24h } },
      }),
      obterResumoFila(),
      db.googleCalendarPendingOperation.count({
        where: {
          status: { in: ["PENDING", "RETRY"] },
          availableAt: { lte: filaParadaAntesDe },
        },
      }),
    ]);

  const alertas: string[] = [];
  if (!runtime.valid) alertas.push("Configuração de runtime inválida.");
  if (semAgendas > 0) alertas.push(`${semAgendas} conexão(ões) ativa(s) sem agenda visível.`);
  if (nuncaSincronizados > 0) alertas.push(`${nuncaSincronizados} agenda(s) nunca sincronizada(s).`);
  if (desatualizados > 0) alertas.push(`${desatualizados} agenda(s) desatualizada(s).`);
  if (runtime.pushEnabled && semCanalAtivo > 0) {
    alertas.push(`${semCanalAtivo} agenda(s) sem canal push ativo.`);
  }
  if (canaisComErro > 0) alertas.push(`${canaisComErro} canal(is) push com erro.`);
  if (expirandoEm24h > 0) alertas.push(`${expirandoEm24h} canal(is) expiram em até 24 horas.`);
  if (fila.DEAD_LETTER > 0) alertas.push(`${fila.DEAD_LETTER} operação(ões) em dead letter.`);
  if (filaAtrasada > 0) alertas.push(`${filaAtrasada} operação(ões) estão paradas na fila.`);
  if (fila.PENDING + fila.RETRY > 100) alertas.push("Fila acima do limite operacional de 100 itens.");

  return {
    ok: alertas.length === 0,
    timestamp: agora.toISOString(),
    runtime,
    conexoes: { ativas, semAgendas },
    calendarios: { total, desatualizados, nuncaSincronizados, semCanalAtivo },
    canais: { ativos: canaisAtivos, comErro: canaisComErro, expirandoEm24h },
    fila,
    filaAtrasada,
    alertas,
  };
}
