import { normalizarNomeEtapa } from "@/lib/bpm/novos-leads";

export const NOME_ETAPA_AGENDAR_REUNIAO = "Agendar reunião";
export const NOME_ETAPA_REUNIAO_AGENDADA = "Reunião Agendada";
export const AUTOMACAO_ORIGEM_AGENDAR_REUNIAO = "agendar_reuniao_8_dias_uteis";

export const ERRO_DATA_REUNIAO_OBRIGATORIA =
  "Preencha Data e Hora da reunião antes de avançar para Reunião Agendada.";

export function etapaEhAgendarReuniao(nome: string): boolean {
  return normalizarNomeEtapa(nome) === normalizarNomeEtapa(NOME_ETAPA_AGENDAR_REUNIAO);
}

export function destinoEhReuniaoAgendada(nome: string): boolean {
  return normalizarNomeEtapa(nome) === normalizarNomeEtapa(NOME_ETAPA_REUNIAO_AGENDADA);
}

/**
 * Standby é uma saída de contingência e não um avanço comercial. Por isso o
 * requisito de reunião se aplica somente ao destino Reunião Agendada.
 */
export function obterErroDataReuniaoParaMovimento(params: {
  etapaOrigemNome: string;
  etapaDestinoNome: string;
  dataReuniao: Date | string | null | undefined;
}): string | null {
  if (
    !etapaEhAgendarReuniao(params.etapaOrigemNome)
    || !destinoEhReuniaoAgendada(params.etapaDestinoNome)
  ) {
    return null;
  }

  if (!params.dataReuniao) return ERRO_DATA_REUNIAO_OBRIGATORIA;
  const data = params.dataReuniao instanceof Date
    ? params.dataReuniao
    : new Date(params.dataReuniao);
  return Number.isNaN(data.getTime()) ? ERRO_DATA_REUNIAO_OBRIGATORIA : null;
}

export type HistoricoEntradaEtapa = {
  createdAt: Date;
  valorNovoJson: string | null;
};

export function resolverInicioCicloNaEtapa(
  etapaId: string,
  createdAtCard: Date,
  historicos: HistoricoEntradaEtapa[],
): Date {
  for (const historico of historicos) {
    if (!historico.valorNovoJson) continue;
    try {
      const valor = JSON.parse(historico.valorNovoJson) as { etapaId?: unknown };
      if (valor.etapaId === etapaId) return historico.createdAt;
    } catch {
      // Históricos legados inválidos são ignorados; o fallback continua determinístico.
    }
  }
  return createdAtCard;
}

