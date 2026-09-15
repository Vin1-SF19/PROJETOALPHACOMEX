import { cnpjEhValido, normalizarCNPJ } from "@/lib/format-cnpj";

export type RecuperacaoCnpj =
  | { status: "valido"; cnpj: string; recuperado: boolean }
  | { status: "invalido"; cnpj: string | null; recuperado: false }
  | { status: "vazio"; cnpj: null; recuperado: false };

export function extrairDigitos(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) return "";
    return String(valor).replace(/\D/g, "");
  }
  if (typeof valor !== "string") return "";
  return valor.replace(/\D/g, "");
}

export function normalizarCnpjMesclagem(valor: unknown): string {
  const texto = typeof valor === "string" ? valor : String(valor ?? "");
  const semEspacos = texto.replace(/[\s \u2007\u202f]/g, "");
  return normalizarCNPJ(semEspacos);
}

export function classificarCnpj(valor: unknown): RecuperacaoCnpj {
  const original = typeof valor === "string" ? valor : String(valor ?? "");
  const digitos = normalizarCnpjMesclagem(valor);

  if (!digitos) {
    return { status: "vazio", cnpj: null, recuperado: false };
  }

  if (digitos.length === 14 && cnpjEhValido(digitos)) {
    return { status: "valido", cnpj: digitos, recuperado: false };
  }

  const temZeroAEsquerda = original.trim().startsWith("0") || original.trim().startsWith("00");
  const candidato = temZeroAEsquerda && digitos.length === 13 ? `0${digitos}` : digitos;

  if (candidato.length === 14 && cnpjEhValido(candidato)) {
    return { status: "valido", cnpj: candidato, recuperado: true };
  }

  return { status: "invalido", cnpj: digitos || null, recuperado: false };
}
