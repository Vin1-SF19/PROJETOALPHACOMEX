import { FINANCIAL_FIELD_KEYS as K } from "@/lib/bpm/pipeline-financeiro";

type Valores = Readonly<Record<string, string | null | undefined>>;
const UFS = new Set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "));

function centavos(valor: string): bigint | null {
  const normalizado = valor.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalizado)) return null;
  const [inteiro, fracao = ""] = normalizado.split(".");
  return BigInt(inteiro) * BigInt(100) + BigInt(fracao.padEnd(2, "0"));
}

function aliquotaEscalada(valor: string): bigint | null {
  const normalizado = valor.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,4})?$/.test(normalizado)) return null;
  const [inteiro, fracao = ""] = normalizado.split(".");
  const escalada = BigInt(inteiro) * BigInt(10000) + BigInt(fracao.padEnd(4, "0"));
  return escalada <= BigInt(1000000) ? escalada : null;
}

function dinheiro(valor: bigint): string {
  return `${valor / BigInt(100)}.${String(valor % BigInt(100)).padStart(2, "0")}`;
}

function retencao(bruto: bigint, aliquota: bigint): bigint {
  return (bruto * aliquota + BigInt(500000)) / BigInt(1000000);
}

export type CalculoNovoContrato = {
  resultados: Partial<Record<string, string>>;
  pendencias: string[];
};

/** Só calcula quando o Financeiro confirmou incidência e alíquota. Não deduz
 * regime tributário ou imposto a partir da consulta cadastral de CNPJ. */
export function calcularNovoContrato(valores: Valores): CalculoNovoContrato {
  const resultados: Record<string, string> = {
    [K.VALOR_IRRF]: "", [K.VALOR_CSRF]: "", [K.TOTAL_RETENCOES]: "",
    [K.VALOR_LIQUIDO]: "", [K.MEMORIA_CALCULO]: "", [K.STATUS_FINANCEIRO]: "",
  };
  const pendencias: string[] = [];
  if (!valores[K.REGIME_CLIENTE]?.trim()) pendencias.push("Regime tributário do cliente");
  if (!valores[K.REGIME_PRESTADOR]?.trim()) pendencias.push("Regime tributário do prestador");
  const bruto = centavos(valores[K.VALOR_BRUTO] ?? "");
  if (bruto === null || bruto <= BigInt(0)) pendencias.push("Valor bruto do contrato");
  const taxas: Array<{ indicador: string; aliquota: string; resultado: string; nome: string }> = [
    { indicador: K.IRRF_APLICAVEL, aliquota: K.ALIQUOTA_IRRF, resultado: K.VALOR_IRRF, nome: "IRRF" },
    { indicador: K.CSRF_APLICAVEL, aliquota: K.ALIQUOTA_CSRF, resultado: K.VALOR_CSRF, nome: "CSRF" },
  ];
  const valoresTaxa: bigint[] = [];
  for (const taxa of taxas) {
    const indicador = valores[taxa.indicador]?.trim();
    if (indicador !== "Sim" && indicador !== "Não") {
      pendencias.push(`${taxa.nome} aplicável`);
      continue;
    }
    if (indicador === "Não") {
      valoresTaxa.push(BigInt(0));
      if (bruto !== null) resultados[taxa.resultado] = "0.00";
      continue;
    }
    const aliquota = aliquotaEscalada(valores[taxa.aliquota] ?? "");
    if (aliquota === null) {
      pendencias.push(`Alíquota ${taxa.nome}`);
      continue;
    }
    if (bruto !== null) {
      const valor = retencao(bruto, aliquota);
      valoresTaxa.push(valor);
      resultados[taxa.resultado] = dinheiro(valor);
    }
  }
  if (pendencias.length || bruto === null) return { resultados, pendencias };
  const total = valoresTaxa.reduce((soma, valor) => soma + valor, BigInt(0));
  if (total > bruto) return { resultados, pendencias: ["Total de retenções superior ao valor bruto"] };
  const liquido = bruto - total;
  resultados[K.TOTAL_RETENCOES] = dinheiro(total);
  resultados[K.VALOR_LIQUIDO] = dinheiro(liquido);
  resultados[K.MEMORIA_CALCULO] = JSON.stringify({
    versao: 1, bruto: dinheiro(bruto), regimeCliente: valores[K.REGIME_CLIENTE] ?? "",
    regimePrestador: valores[K.REGIME_PRESTADOR] ?? "",
    irrf: { aplicavel: valores[K.IRRF_APLICAVEL], aliquota: valores[K.IRRF_APLICAVEL] === "Sim" ? valores[K.ALIQUOTA_IRRF] ?? "" : "", valor: resultados[K.VALOR_IRRF] },
    csrf: { aplicavel: valores[K.CSRF_APLICAVEL], aliquota: valores[K.CSRF_APLICAVEL] === "Sim" ? valores[K.ALIQUOTA_CSRF] ?? "" : "", valor: resultados[K.VALOR_CSRF] },
    total: dinheiro(total), liquido: dinheiro(liquido),
  });
  if (valores[K.VENCIMENTO]?.trim() && valores[K.DADOS_PAGAMENTO]?.trim()) {
    resultados[K.STATUS_FINANCEIRO] = "Aguardando pagamento";
  }
  return { resultados, pendencias: [] };
}

export function pendenciasValidacaoNovoContrato(valores: Valores): string[] {
  const pendencias: string[] = [];
  const cep = valores[K.CEP]?.trim() ?? "";
  if (cep && !/^\d{5}-?\d{3}$/.test(cep)) pendencias.push("CEP inválido");
  const uf = valores[K.ESTADO]?.trim().toUpperCase() ?? "";
  if (uf && !UFS.has(uf)) pendencias.push("Estado (UF) inválido");
  const bruto = valores[K.VALOR_BRUTO]?.trim();
  if (bruto && (centavos(bruto) ?? BigInt(0)) <= BigInt(0)) pendencias.push("Valor bruto do contrato inválido");
  return pendencias;
}
