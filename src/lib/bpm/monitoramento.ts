import { normalizarNomeEtapa } from "@/lib/bpm/novos-leads";

export const NOME_ETAPA_MONITORAMENTO = "Monitoramento";
export const INTERVALO_DIAS_MONITORAMENTO = 30;
export const AUTOMACAO_ORIGEM_MONITORAMENTO = "monitoramento_mensal";
export const ACAO_MONITORAMENTO_EXECUTADO = "MONITORAMENTO_AUTOMATICO_EXECUTADO";
export const TITULO_TAREFA_MONITORAMENTO = "Revisar monitoramento";
export const NOME_ETAPA_EM_TRATATIVA = "Em tratativa";
export const NOME_ETAPA_LOST = "Lost";

const ETAPAS_SAIDA_MONITORAMENTO = new Set([
  normalizarNomeEtapa(NOME_ETAPA_EM_TRATATIVA),
  normalizarNomeEtapa(NOME_ETAPA_LOST),
]);

export function etapaEhMonitoramento(nome: string): boolean {
  return normalizarNomeEtapa(nome) === normalizarNomeEtapa(NOME_ETAPA_MONITORAMENTO);
}

/**
 * Monitoramento é uma pausa operacional: recebe cards somente de Em Tratativa
 * e pode retornar à tratativa ou ser encerrado como Lost. A regra fica aqui
 * para os fluxos de drag, modal e action direta consultarem a mesma fonte.
 */
export function obterErroTransicaoMonitoramento(params: {
  etapaOrigemNome: string;
  etapaDestinoNome: string;
}): string | null {
  const origem = normalizarNomeEtapa(params.etapaOrigemNome);
  const destino = normalizarNomeEtapa(params.etapaDestinoNome);
  const monitoramento = normalizarNomeEtapa(NOME_ETAPA_MONITORAMENTO);

  if (destino === monitoramento && origem !== normalizarNomeEtapa(NOME_ETAPA_EM_TRATATIVA)) {
    return "Monitoramento só pode receber cards vindos de Em Tratativa.";
  }

  if (origem === monitoramento && !ETAPAS_SAIDA_MONITORAMENTO.has(destino)) {
    return "De Monitoramento, mova o card apenas para Em Tratativa ou Lost.";
  }

  return null;
}

/**
 * A revisão é mensal e indefinida enquanto o card permanecer em Monitoramento.
 * Uma execução anterior à entrada atual não pode antecipar um ciclo de reentrada.
 */
export function calcularProximaRevisaoMonitoramento(
  entradaEmMonitoramento: Date,
  ultimaExecucaoEm: Date | null,
): Date {
  const base = ultimaExecucaoEm && ultimaExecucaoEm >= entradaEmMonitoramento
    ? ultimaExecucaoEm
    : entradaEmMonitoramento;
  return new Date(base.getTime() + INTERVALO_DIAS_MONITORAMENTO * 24 * 60 * 60 * 1000);
}

export function monitoramentoEstaVencido(params: {
  entradaEmMonitoramento: Date;
  ultimaExecucaoEm: Date | null;
  agora?: Date;
}): boolean {
  return (params.agora ?? new Date()) >= calcularProximaRevisaoMonitoramento(
    params.entradaEmMonitoramento,
    params.ultimaExecucaoEm,
  );
}
