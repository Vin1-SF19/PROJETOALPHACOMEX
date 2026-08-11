import { list } from "@vercel/blob";
import {
  configuracaoDaFontePorNomeArquivo,
  fontePersonalizadaSchema,
  type FontePersonalizada,
} from "@/lib/apresentacoes/fontes-personalizadas";

export const PREFIXO_FONTES_GLOBAIS = "apresentacoes/fontes-globais/";
export const LIMITE_FONTES_GLOBAIS = 200;

export function caminhoFonteGlobal(id: string, nome: string, nomeArquivoSeguro: string): string {
  return `${PREFIXO_FONTES_GLOBAIS}${id}/${encodeURIComponent(nome)}/${nomeArquivoSeguro}`;
}

export function fonteGlobalDoBlob(blob: {
  pathname: string;
  url: string;
  size: number;
  uploadedAt: Date;
}): FontePersonalizada | null {
  if (!blob.pathname.startsWith(PREFIXO_FONTES_GLOBAIS)) return null;
  const partes = blob.pathname.slice(PREFIXO_FONTES_GLOBAIS.length).split("/");
  if (partes.length !== 3) return null;

  const [id, nomeCodificado, nomeOriginal] = partes;
  const configuracao = configuracaoDaFontePorNomeArquivo(nomeOriginal);
  if (!configuracao) return null;

  let nome: string;
  try {
    nome = decodeURIComponent(nomeCodificado);
  } catch {
    return null;
  }

  const resultado = fontePersonalizadaSchema.safeParse({
    id,
    nome,
    url: blob.url,
    formato: configuracao.formato,
    mimeType: configuracao.mimeType,
    nomeOriginal,
    tamanhoBytes: blob.size,
    criadoEm: blob.uploadedAt.toISOString(),
  });
  return resultado.success ? resultado.data : null;
}

/** Catálogo compartilhado por todos os usuários, armazenado sem dependência de schema. */
export async function listarFontesGlobais(): Promise<FontePersonalizada[]> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return [];

  const fontes: FontePersonalizada[] = [];
  let cursor: string | undefined;
  do {
    const pagina = await list({ prefix: PREFIXO_FONTES_GLOBAIS, limit: 1000, cursor, token });
    for (const blob of pagina.blobs) {
      const fonte = fonteGlobalDoBlob(blob);
      if (fonte) fontes.push(fonte);
    }
    cursor = pagina.hasMore ? pagina.cursor : undefined;
  } while (cursor && fontes.length < LIMITE_FONTES_GLOBAIS);

  return fontes
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, LIMITE_FONTES_GLOBAIS);
}
