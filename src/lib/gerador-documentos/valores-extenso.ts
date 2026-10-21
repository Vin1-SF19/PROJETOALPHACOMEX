import extenso from "extenso";

const PARES_EXTENSO = [
  ["valor_total", "valor_total_extenso"],
  ["valor_inicial", "valor_inicial_extenso"],
  ["valor_final", "valor_final_extenso"],
  ["desconto_valor", "desconto_extenso"],
] as const;

type Definicao = { nome: string };

/** Converte reais sem passar strings por ponto flutuante nem arredondar centavos. */
export function valorMonetarioPorExtenso(valor: unknown): string {
  if (typeof valor !== "string" && typeof valor !== "number") return "";
  if (typeof valor === "number" && (!Number.isFinite(valor) || !Number.isSafeInteger(Math.trunc(valor)))) return "";
  const texto = String(valor).trim().replace(/^R\$\s*/, "");
  let decimal: string;
  if (/^-?\d+(?:\.\d{1,2})?$/.test(texto)) {
    decimal = texto;
  } else if (/^-?(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(texto)) {
    decimal = texto.replaceAll(".", "").replace(",", ".");
  } else {
    // "1.234" é ambíguo entre agrupamento e três casas decimais: não adivinhar.
    return "";
  }
  // O renderer existente formata moeda com Number. Só preencher quando ele
  // também consegue apresentar os mesmos centavos, sem arredondar o contrato.
  const [inteiro, fracao = ""] = decimal.replace(/^-/, "").split(".");
  const centavos = BigInt(inteiro) * BigInt(100) + BigInt(fracao.padEnd(2, "0"));
  if (centavos > BigInt(Number.MAX_SAFE_INTEGER)) return "";
  const canonico = `${decimal.startsWith("-") ? "-" : ""}${BigInt(inteiro)}.${fracao.padEnd(2, "0")}`;
  const apresentado = Number(decimal).toLocaleString("en-US", { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (apresentado !== canonico) return "";
  try {
    return extenso(decimal, { mode: "currency", locale: "br", currency: { code: "BRL" }, decimalSeparator: "point" });
  } catch {
    // Inclui valores fora da escala suportada pela biblioteca.
    return "";
  }
}

/** Só torna automático um extenso quando fonte e destino pertencem ao template. */
export function campoExtensoAutomatico(nome: string, definicoes: readonly Definicao[]): boolean {
  const nomes = new Set(definicoes.map((item) => item.nome));
  return PARES_EXTENSO.some(([fonte, destino]) => destino === nome && nomes.has(fonte) && nomes.has(destino));
}

/** Preserva fontes, flags e variáveis alheias; campoAlterado limita mudanças ao par digitado. */
export function sincronizarValoresPorExtenso<T>(
  definicoes: readonly Definicao[],
  valores: Record<string, T>,
  campoAlterado?: string,
): Record<string, T | string> {
  const novos: Record<string, T | string> = { ...valores };
  const nomes = new Set(definicoes.map((item) => item.nome));
  for (const [fonte, destino] of PARES_EXTENSO) {
    if (nomes.has(fonte) && nomes.has(destino) && (!campoAlterado || campoAlterado === fonte)) {
      novos[destino] = valorMonetarioPorExtenso(valores[fonte]);
    }
  }
  return novos;
}
