/**
 * Validação de CNPJ com dígitos verificadores.
 * Retorna true se o CNPJ (14 dígitos) for válido.
 */
export function validarCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false; // todos iguais

  // 1º dígito verificador
  let sum = 0;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i]) * weights1[i];
  }
  const resto1 = sum % 11;
  const dv1 = resto1 < 2 ? 0 : 11 - resto1;
  if (dv1 !== parseInt(digits[12])) return false;

  // 2º dígito verificador
  let sum2 = 0;
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  for (let i = 0; i < 13; i++) {
    sum2 += parseInt(digits[i]) * weights2[i];
  }
  const resto2 = sum2 % 11;
  const dv2 = resto2 < 2 ? 0 : 11 - resto2;
  if (dv2 !== parseInt(digits[13])) return false;

  return true;
}
