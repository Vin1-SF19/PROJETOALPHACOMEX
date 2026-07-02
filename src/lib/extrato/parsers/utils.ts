/**
 * Utilitários compartilhados entre os parsers determinísticos de extrato.
 * Formato monetário brasileiro: 1.234,56 (ponto de milhar, vírgula decimal).
 */

/** Regex de valor monetário brasileiro, ex: "1.234,56" ou "897.951,29" ou "33.831,66". */
export const REGEX_VALOR_BR = /-?\d{1,3}(?:\.\d{3})*,\d{2}/g;

/** Regex de data completa DD/MM/YYYY (ano com 4 dígitos) no início da linha. */
export const REGEX_DATA_INICIO = /^(\d{2}\/\d{2}\/\d{4})\b/;

/** Converte "1.234,56" (ou "-1.234,56") para o número 1234.56 (ou -1234.56). */
export function paraNumeroBR(valorTexto: string): number {
  const negativo = valorTexto.trim().startsWith("-");
  const limpo = valorTexto.replace(/-/g, "").replace(/\./g, "").replace(",", ".");
  const numero = parseFloat(limpo) || 0;
  return negativo ? -numero : numero;
}

/** Extrai todos os valores monetários BR encontrados numa linha, na ordem em que aparecem. */
export function extrairValoresBR(linha: string): string[] {
  return linha.match(REGEX_VALOR_BR) ?? [];
}

/** Remove espaços duplicados e aparas nas pontas. */
export function limparDescricao(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

/**
 * Linhas de cabeçalho/rodapé comuns a extratos bancários brasileiros — não são
 * transações e devem ser descartadas antes ou durante o parsing.
 */
export const PADROES_LINHA_IGNORAR: RegExp[] = [
  /saldo\s+anterior/i,
  /saldo\s+atual/i,
  /saldo\s+dispon[íi]vel/i,
  /total\s+(dispon[íi]vel|geral)/i,
  /extrato\s+(mensal|de|por\s+per[íi]odo)/i,
  /data\s+lan[çc]amento/i,
  /ag[êe]ncia\s*\|?\s*conta/i,
  /cnpj\s*:/i,
  /nome\s+do\s+usu[áa]rio/i,
  /data\s+da\s+opera[çc][ãa]o/i,
];

export function deveIgnorarLinha(linha: string): boolean {
  const t = linha.trim();
  if (!t) return true;
  return PADROES_LINHA_IGNORAR.some((re) => re.test(t));
}
