import { del } from "@vercel/blob";

/**
 * Store dedicado do Alpha Motion. O SDK do Vercel Blob seleciona o store pelo read/write
 * token; MOTION_STORE_ID fica disponível para diagnóstico/configuração da integração.
 */
export function obterTokenMotion(): string {
  const token = process.env.MOTION_READ_WRITE_TOKEN?.trim();
  if (!token) throw new Error("MOTION_READ_WRITE_TOKEN não configurado");
  return token;
}

export function obterMotionStoreId(): string | null {
  return process.env.MOTION_STORE_ID?.trim() || null;
}

export function obterTokensMotionComLegado(): string[] {
  return Array.from(new Set([
    process.env.MOTION_READ_WRITE_TOKEN?.trim(),
    process.env.BLOB_READ_WRITE_TOKEN?.trim(),
  ].filter((token): token is string => Boolean(token))));
}

/** Exclui primeiro no store Motion e tenta o store antigo para assets criados antes da migração. */
export async function excluirBlobMotion(url: string | string[]): Promise<void> {
  const tokens = obterTokensMotionComLegado();
  let ultimoErro: unknown;
  for (const token of tokens) {
    try {
      await del(url, { token });
      return;
    } catch (error) {
      ultimoErro = error;
    }
  }
  if (ultimoErro) throw ultimoErro;
  throw new Error("MOTION_READ_WRITE_TOKEN não configurado");
}
