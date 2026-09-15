import type { AgendaAlphaRuntimeConfig } from "./runtime-config";

export const LIMITE_AGENDA_DESATUALIZADA_MS = 15 * 60 * 1_000;

export type EstadoSaudeAgendaAlpha =
  | "desativada"
  | "sem_agendas"
  | "primeira_sincronizacao"
  | "saudavel"
  | "desatualizada"
  | "com_erro";

export interface CalendarioSaudeAgendaAlpha {
  visivel: boolean;
  syncToken: string | null;
  ultimaSincronizacaoEm: Date | null;
  eventosEmCache: number;
  canais: Array<{ status: string; expiresAt: Date }>;
  operacoesComErro: number;
}

export interface SaudeAgendaAlpha {
  estado: EstadoSaudeAgendaAlpha;
  mensagem: string;
  calendariosSelecionados: number;
  calendariosVisiveis: number;
  calendariosNuncaSincronizados: number;
  eventosEmCache: number;
  canaisAtivos: number;
  calendariosSemCanalAtivo: number;
  canaisComErro: number;
  operacoesComErro: number;
  sincronizacaoAutomaticaDisponivel: boolean;
}

export function calcularSaudeAgendaAlpha(input: {
  conectado: boolean;
  calendarios: CalendarioSaudeAgendaAlpha[];
  runtime: AgendaAlphaRuntimeConfig;
  agora?: Date;
}): SaudeAgendaAlpha {
  const agora = input.agora ?? new Date();
  const visiveis = input.calendarios.filter((calendario) => calendario.visivel);
  const nuncaSincronizados = visiveis.filter(
    (calendario) => !calendario.syncToken || !calendario.ultimaSincronizacaoEm,
  ).length;
  const eventosEmCache = visiveis.reduce(
    (total, calendario) => total + calendario.eventosEmCache,
    0,
  );
  const canaisAtivos = visiveis.reduce(
    (total, calendario) =>
      total +
      calendario.canais.filter(
        (canal) => canal.status === "ACTIVE" && canal.expiresAt > agora,
      ).length,
    0,
  );
  const canaisComErro = visiveis.reduce(
    (total, calendario) =>
      total + calendario.canais.filter((canal) => canal.status === "ERROR").length,
    0,
  );
  const calendariosSemCanalAtivo = visiveis.filter(
    (calendario) =>
      !calendario.canais.some(
        (canal) => canal.status === "ACTIVE" && canal.expiresAt > agora,
      ),
  ).length;
  const operacoesComErro = visiveis.reduce(
    (total, calendario) => total + calendario.operacoesComErro,
    0,
  );
  const sincronizacaoAutomaticaDisponivel =
    input.runtime.valid &&
    input.runtime.distributedLockEnabled &&
    input.runtime.queueEnabled &&
    input.runtime.pushEnabled &&
    Boolean(input.runtime.webhookBaseUrl) &&
    calendariosSemCanalAtivo === 0;

  const base = {
    calendariosSelecionados: input.calendarios.length,
    calendariosVisiveis: visiveis.length,
    calendariosNuncaSincronizados: nuncaSincronizados,
    eventosEmCache,
    canaisAtivos,
    calendariosSemCanalAtivo,
    canaisComErro,
    operacoesComErro,
    sincronizacaoAutomaticaDisponivel,
  };

  if (!input.conectado) {
    return { ...base, estado: "desativada", mensagem: "Agenda Alpha desativada." };
  }
  if (visiveis.length === 0) {
    return {
      ...base,
      estado: "sem_agendas",
      mensagem: "Escolha ao menos uma agenda Google.",
    };
  }
  if (nuncaSincronizados > 0) {
    return {
      ...base,
      estado: "primeira_sincronizacao",
      mensagem: "A primeira sincronização ainda não terminou.",
    };
  }
  if (canaisComErro > 0 || operacoesComErro > 0) {
    return {
      ...base,
      estado: "com_erro",
      mensagem: "A sincronização automática precisa de atenção.",
    };
  }

  const limite = agora.getTime() - LIMITE_AGENDA_DESATUALIZADA_MS;
  const desatualizada = visiveis.some(
    (calendario) =>
      !calendario.ultimaSincronizacaoEm ||
      calendario.ultimaSincronizacaoEm.getTime() <= limite,
  );
  if (desatualizada || !sincronizacaoAutomaticaDisponivel) {
    return {
      ...base,
      estado: "desatualizada",
      mensagem: sincronizacaoAutomaticaDisponivel
        ? "A agenda está desatualizada e será reconciliada."
        : "A atualização automática não está disponível.",
    };
  }

  return { ...base, estado: "saudavel", mensagem: "Agenda sincronizada." };
}
