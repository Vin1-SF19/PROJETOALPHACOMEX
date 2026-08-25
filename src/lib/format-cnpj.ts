/**
 * Formata um CNPJ bruto (somente dígitos ou com pontuação parcial)
 * para o padrão `00.000.000/0000-00`.
 * Retorna `null` se o valor não contiver exatamente 14 dígitos.
 */
export function formatCNPJ(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const digits = valor.replace(/\D/g, "");
  if (digits.length !== 14) return null;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}
