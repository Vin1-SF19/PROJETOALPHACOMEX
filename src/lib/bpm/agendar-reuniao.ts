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

export const CONTATOS_CONSECUTIVOS_EXIGIDOS = 8;
export const ERRO_CONTATOS_CONSECUTIVOS_INSUFICIENTES =
  `São necessários ${CONTATOS_CONSECUTIVOS_EXIGIDOS} contatos em ${CONTATOS_CONSECUTIVOS_EXIGIDOS} dias consecutivos para avançar a partir da etapa "${NOME_ETAPA_AGENDAR_REUNIAO}".`;

/**
 * Conta o maior número de dias corridos consecutivos (fuso America/Sao_Paulo)
 * com pelo menos um contato registrado, a partir das datas informadas.
 */
export function contarMaiorSequenciaDiasConsecutivos(datas: readonly (Date | string)[]): number {
  const diasUnicos = new Set(
    datas.map((data) => {
      const valor = data instanceof Date ? data : new Date(data);
      return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(valor);
    }),
  );

  const diasOrdenados = Array.from(diasUnicos)
    .map((dia) => new Date(`${dia}T00:00:00.000Z`).getTime())
    .sort((a, b) => a - b);

  const UM_DIA_MS = 24 * 60 * 60 * 1000;
  let maiorSequencia = diasOrdenados.length > 0 ? 1 : 0;
  let sequenciaAtual = maiorSequencia;

  for (let indice = 1; indice < diasOrdenados.length; indice += 1) {
    const diferenca = diasOrdenados[indice] - diasOrdenados[indice - 1];
    sequenciaAtual = diferenca === UM_DIA_MS ? sequenciaAtual + 1 : 1;
    if (sequenciaAtual > maiorSequencia) maiorSequencia = sequenciaAtual;
  }

  return maiorSequencia;
}

/**
 * Regra de negócio do pipeline Radar: sair de "Agendar reunião" exige 8 contatos
 * registrados (BpmInteracaoCard) em 8 dias corridos consecutivos — qualquer
 * sequência de 8 dias, não necessariamente terminando hoje.
 */
export function obterErroContatosConsecutivosParaMovimento(params: {
  etapaOrigemNome: string;
  datasContato: readonly (Date | string)[];
}): string | null {
  if (!etapaEhAgendarReuniao(params.etapaOrigemNome)) return null;
  const maiorSequencia = contarMaiorSequenciaDiasConsecutivos(params.datasContato);
  if (maiorSequencia >= CONTATOS_CONSECUTIVOS_EXIGIDOS) return null;
  return `${ERRO_CONTATOS_CONSECUTIVOS_INSUFICIENTES} Contatos consecutivos registrados: ${maiorSequencia} de ${CONTATOS_CONSECUTIVOS_EXIGIDOS}.`;
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

