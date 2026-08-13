/** Converte string monetária BR ("1.234,56") ou número em number. */
export function parseMoeda(valor: unknown): number {
  if (typeof valor === "number") return valor;
  if (!valor) return 0;
  const apenasNumeros = String(valor).replace(/[^\d.,-]/g, "");
  const valorLimpo = apenasNumeros.replace(/\./g, "").replace(",", ".");
  return parseFloat(valorLimpo) || 0;
}

/** Formata um input de moeda enquanto o usuário digita (só dígitos → "1.234,56"). */
export function formatarMoedaInput(valor: string): string {
  const apenasNumeros = valor.replace(/\D/g, "");
  if (!apenasNumeros) return "";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2 }).format(
    parseFloat(apenasNumeros) / 100,
  );
}

export function formatarValorBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * `Cliente.cnpj` é nullable desde a Fase 2 do Cliente Master (empresa "em
 * constituição" sem CNPJ ainda) — trata ausência explicitamente em vez de
 * quebrar em runtime.
 */
export function formatarCnpj(cnpj: string | null | undefined): string {
  if (!cnpj) return "CNPJ pendente";
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

/** Formata Transacao.data (Date | null) com fallback para dataOriginalTexto. */
export function formatarDataTransacao(data: Date | string | null, dataOriginalTexto?: string | null): string {
  if (data) {
    const d = typeof data === "string" ? new Date(data) : data;
    if (!isNaN(d.getTime())) return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  }
  return dataOriginalTexto?.trim() || "—";
}
