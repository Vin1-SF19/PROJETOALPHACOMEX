/** Estado dos dois requisitos independentes da contratação financeira. */
export type EstadoRequisitoFinanceiro = "Pendente" | "Concluído";

export type EntradaFormalizacaoFinanceira = {
  statusAssinatura: string | null | undefined;
  dataAssinatura: string | null | undefined;
  anexoAssinadoId: string | null | undefined;
  anexoAssinadoVinculado: boolean;
  pagamentoConfirmado: string | null | undefined;
};

function dataCivilValida(valor: string | null | undefined): boolean {
  if (!valor || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00.000Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

export function avaliarFormalizacaoFinanceira(entrada: EntradaFormalizacaoFinanceira) {
  const assinaturaConfirmada = entrada.statusAssinatura === "Assinado";
  const dataConfirmada = dataCivilValida(entrada.dataAssinatura);
  const documentoConfirmado = Boolean(entrada.anexoAssinadoId?.trim() && entrada.anexoAssinadoVinculado);
  const contrato: EstadoRequisitoFinanceiro = assinaturaConfirmada && dataConfirmada && documentoConfirmado
    ? "Concluído" : "Pendente";
  const pagamento: EstadoRequisitoFinanceiro = entrada.pagamentoConfirmado === "Sim"
    ? "Concluído" : "Pendente";
  const pendencias: string[] = [];
  if (!assinaturaConfirmada) pendencias.push("Status da assinatura");
  if (!dataConfirmada) pendencias.push("Data da assinatura");
  if (!documentoConfirmado) pendencias.push("Contrato assinado/anexo");
  if (pagamento === "Pendente") pendencias.push("Pagamento confirmado");
  return {
    contrato,
    pagamento,
    contratacaoConcluida: contrato === "Concluído" && pagamento === "Concluído",
    pendencias,
  };
}
