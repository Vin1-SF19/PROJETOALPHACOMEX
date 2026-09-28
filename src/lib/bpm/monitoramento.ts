import { normalizarNomeEtapa } from "@/lib/bpm/novos-leads";
import { grupoCondicaoSchema } from "@/lib/bpm/regras/schemas";

export const NOME_ETAPA_MONITORAMENTO = "Monitoramento";
export const INTERVALO_DIAS_MONITORAMENTO = 30;
export const AUTOMACAO_ORIGEM_MONITORAMENTO = "monitoramento_mensal";
export const CHAVE_AUTOMACAO_REVISAO_MONITORAMENTO = "monitoramento_revisao_interna";
export const CHAVE_AUTOMACAO_CONDICAO_MONITORAMENTO = "monitoramento_condicao_retorno";

export function validarAtivacaoCondicaoMonitoramento(chave: string | null | undefined, condicao: unknown): void {
  if (chave !== CHAVE_AUTOMACAO_CONDICAO_MONITORAMENTO) return;
  let valor = condicao;
  if (typeof valor === "string") {
    try { valor = JSON.parse(valor); } catch { valor = null; }
  }
  if (!grupoCondicaoSchema.safeParse(valor).success) throw new Error("Defina uma condição de interesse válida antes de ativar o retorno de Monitoramento.");
}
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
 * e pode retornar à tratativa ou ser encerrado como Lost. O retorno automático
 * para Agendar Reunião depende da transição e da condição configuradas.
 * A matriz efetiva de movimento é validada pelo comando de transição.
 */
export function obterErroTransicaoMonitoramento(params: {
  etapaOrigemNome: string;
  etapaDestinoNome: string;
  atorTipo?: "MANUAL" | "AUTOMACAO";
}): string | null {
  const origem = normalizarNomeEtapa(params.etapaOrigemNome);
  const destino = normalizarNomeEtapa(params.etapaDestinoNome);
  const monitoramento = normalizarNomeEtapa(NOME_ETAPA_MONITORAMENTO);

  if (destino === monitoramento && !["Em tratativa", "Em tratativas"].some((nome) => origem === normalizarNomeEtapa(nome))) {
    return "Monitoramento só pode receber cards vindos de Em Tratativa.";
  }

  const retornoAutomatico = params.atorTipo === "AUTOMACAO" && destino === normalizarNomeEtapa("Agendar Reunião");
  if (origem === monitoramento && !ETAPAS_SAIDA_MONITORAMENTO.has(destino) && !retornoAutomatico) {
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
