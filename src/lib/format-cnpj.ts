/**
 * Remove tudo que não for dígito e limita o resultado a 14 caracteres.
 * Fonte única de normalização de CNPJ — usar em toda entrada de dados
 * (onChange, colagem, submit, busca) antes de persistir ou consultar.
 */
export function normalizarCNPJ(valor: string | null | undefined): string {
  if (!valor) return "";
  return valor.replace(/\D/g, "").slice(0, 14);
}

/**
 * Formata progressivamente um CNPJ (dígitos crus ou parciais) aplicando a
 * máscara `00.000.000/0000-00` conforme o usuário digita ou cola conteúdo.
 */
export function formatarCNPJProgressivo(valor: string | null | undefined): string {
  const digits = normalizarCNPJ(valor);
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{2}\.\d{3})(\d)/, "$1.$2")
    .replace(/(\d{2}\.\d{3}\.\d{3})(\d)/, "$1/$2")
    .replace(/(\d{2}\.\d{3}\.\d{3}\/\d{4})(\d)/, "$1-$2");
}

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

const PESOS_CNPJ_DV1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const PESOS_CNPJ_DV2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function digitoVerificadorCnpj(base: string, pesos: readonly number[]): number {
  const soma = [...base].reduce((total, digito, indice) => total + Number(digito) * pesos[indice], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** Valida os dígitos verificadores de um CNPJ (14 dígitos numéricos). */
export function cnpjEhValido(valor: string | null | undefined): boolean {
  const digits = valor?.replace(/\D/g, "") ?? "";
  if (digits.length !== 14) return false;
  if (digits === digits[0].repeat(14)) return false;
  const dv1 = digitoVerificadorCnpj(digits.slice(0, 12), PESOS_CNPJ_DV1);
  if (dv1 !== Number(digits[12])) return false;
  const dv2 = digitoVerificadorCnpj(digits.slice(0, 13), PESOS_CNPJ_DV2);
  return dv2 === Number(digits[13]);
}
