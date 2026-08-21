import { z } from "zod";

const SAFE_BUSINESS_MESSAGES = [
  /^Aprovação de custo necessária/,
  /^Uma requisição idêntica já está em andamento$/,
  /^A tag está vinculada a \d+ palavra\(s\)-chave$/,
];

export function safeAlphaSeoActionError(error: unknown): string {
  if (error instanceof z.ZodError) return "Dados inválidos";
  if (
    error instanceof Error &&
    error.name === "AlphaSeoAccessError" &&
    typeof (error as Error & { code?: unknown }).code === "string"
  ) {
    return error.message;
  }
  const message = error instanceof Error ? error.message : "";
  if (/^[A-Z][A-Z0-9_]{2,120}$/.test(message)) return message;
  if (SAFE_BUSINESS_MESSAGES.some((pattern) => pattern.test(message))) return message;
  return "Não foi possível concluir a operação Alpha SEO";
}
