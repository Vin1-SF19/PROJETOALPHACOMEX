import {
  VALORES,
  REQUISITOS_CONTRATO,
  REQUISITOS_PAGAMENTO,
  type EntradaRequisitosFinanceiro,
  type ResultadoRequisitosFinanceiro,
} from "@/lib/bpm/financeiro-config";

/** Estado dos dois requisitos independentes da contratação financeira. */
export type EstadoRequisitoFinanceiro = typeof VALORES.PENDENTE | typeof VALORES.CONCLUIDO;

export type EntradaFormalizacaoFinanceira = EntradaRequisitosFinanceiro;

function dataCivilValida(valor: string | null | undefined): boolean {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00.000Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

export function avaliarFormalizacaoFinanceira(entrada: EntradaFormalizacaoFinanceira): ResultadoRequisitosFinanceiro {
  const assinaturaConfirmada = entrada.statusAssinatura === VALORES.ASSINADO;
  const dataConfirmada = dataCivilValida(entrada.dataAssinatura);
  const documentoConfirmado = Boolean(entrada.anexoAssinadoId?.trim() && entrada.anexoAssinadoVinculado);
  const contrato: EstadoRequisitoFinanceiro = assinaturaConfirmada && dataConfirmada && documentoConfirmado
    ? VALORES.CONCLUIDO : VALORES.PENDENTE;
  const pagamento: EstadoRequisitoFinanceiro = entrada.pagamentoConfirmado === VALORES.SIM
    ? VALORES.CONCLUIDO : VALORES.PENDENTE;
  const pendencias: string[] = [];
  if (!assinaturaConfirmada) pendencias.push(REQUISITOS_CONTRATO[0].rotulo);
  if (!dataConfirmada) pendencias.push(REQUISITOS_CONTRATO[1].rotulo);
  if (!documentoConfirmado) pendencias.push(REQUISITOS_CONTRATO[2].rotulo);
  if (pagamento === VALORES.PENDENTE) pendencias.push(REQUISITOS_PAGAMENTO[0].rotulo);
  return {
    contrato,
    pagamento,
    contratacaoConcluida: contrato === VALORES.CONCLUIDO && pagamento === VALORES.CONCLUIDO,
    pendencias,
  };
}
