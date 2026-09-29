export type EntradaValidacaoPagamento = {
  confirmado: string | null | undefined;
  data: string | null | undefined;
  esperado: string | null | undefined;
  recebido: string | null | undefined;
  forma: string | null | undefined;
  comprovanteExigido: boolean;
  comprovanteValido: boolean;
  liquido: string | null | undefined;
  bruto: string | null | undefined;
  retencoes: string | null | undefined;
};

function centavos(valor: string | null | undefined): bigint | null {
  const normalizado = valor?.trim().replace(",", ".") ?? "";
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalizado)) return null;
  const [inteiro, fracao = ""] = normalizado.split(".");
  return BigInt(inteiro) * BigInt(100) + BigInt(fracao.padEnd(2, "0"));
}

export function avaliarPagamentoFinanceiro(entrada: EntradaValidacaoPagamento) {
  const esperado = centavos(entrada.esperado);
  const recebido = centavos(entrada.recebido);
  const liquido = centavos(entrada.liquido);
  const bruto = centavos(entrada.bruto);
  const retencoes = centavos(entrada.retencoes);
  const origem = liquido ?? (retencoes === null || retencoes === BigInt(0) ? bruto : null);
  const pendencias: string[] = [];
  if (esperado === null) pendencias.push("Valor esperado");
  if (origem === null || esperado !== origem) pendencias.push("Valor esperado divergente do valor líquido calculado");
  if (entrada.confirmado === "Sim") {
    const data = entrada.data?.trim() ?? "";
    if (!data || Number.isNaN(Date.parse(data))) pendencias.push("Data do pagamento");
    if (recebido === null) pendencias.push("Valor recebido");
    if (!entrada.forma?.trim()) pendencias.push("Forma de pagamento utilizada");
    if (entrada.comprovanteExigido && !entrada.comprovanteValido) pendencias.push("Comprovante");
  } else {
    pendencias.push("Pagamento confirmado");
  }
  const divergencia = esperado !== null && recebido !== null && esperado !== recebido;
  if (entrada.confirmado === "Sim" && divergencia) pendencias.push("Divergência financeira: valor recebido diferente do esperado");
  return { concluido: pendencias.length === 0, divergencia, pendencias };
}
