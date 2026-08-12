import { list, put } from "@vercel/blob";
import { createHash } from "node:crypto";
import {
  configuracaoDaFontePorNomeArquivo,
  fontePersonalizadaSchema,
  type FontePersonalizada,
} from "@/lib/apresentacoes/fontes-personalizadas";
import { obterTokenMotion, obterTokensMotionComLegado } from "@/lib/apresentacoes/blob";
import type { FonteEmbutidaPptx } from "@/lib/apresentacoes/pptx/fontes-embutidas";

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
  const fontes: FontePersonalizada[] = [];
  const ids = new Set<string>();
  for (const token of obterTokensMotionComLegado()) {
    let cursor: string | undefined;
    do {
      const pagina = await list({ prefix: PREFIXO_FONTES_GLOBAIS, limit: 1000, cursor, token });
      for (const blob of pagina.blobs) {
        const fonte = fonteGlobalDoBlob(blob);
        if (fonte && !ids.has(fonte.id)) {
          ids.add(fonte.id);
          fontes.push(fonte);
        }
      }
      cursor = pagina.hasMore ? pagina.cursor : undefined;
    } while (cursor && fontes.length < LIMITE_FONTES_GLOBAIS);
    if (fontes.length >= LIMITE_FONTES_GLOBAIS) break;
  }

  return fontes
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .slice(0, LIMITE_FONTES_GLOBAIS);
}

/** Publica no catálogo compartilhado as famílias realmente incorporadas ao arquivo PowerPoint. */
export async function garantirFontesEmbutidasGlobais(fontes: FonteEmbutidaPptx[]): Promise<FontePersonalizada[]> {
  const catalogo = await listarFontesGlobais();
  const porNome = new Map(catalogo.map((fonte) => [fonte.nome.toLocaleLowerCase("pt-BR"), fonte]));
  const resultado: FontePersonalizada[] = [];

  for (const fonte of fontes) {
    const chave = fonte.nome.toLocaleLowerCase("pt-BR");
    const existente = porNome.get(chave);
    if (existente) {
      resultado.push(existente);
      continue;
    }
    if (porNome.size >= LIMITE_FONTES_GLOBAIS) break;

    const id = crypto.randomUUID();
    const extensao = fonte.formato === "opentype" ? "otf" : "ttf";
    const hash = createHash("sha256").update(fonte.bytes).digest("hex").slice(0, 16);
    const nomeArquivo = `pptx-${hash}.${extensao}`;
    const blob = await put(caminhoFonteGlobal(id, fonte.nome, nomeArquivo), Buffer.from(fonte.bytes), {
      access: "public",
      addRandomSuffix: false,
      contentType: fonte.mimeType,
      token: obterTokenMotion(),
    });
    const publicada = fontePersonalizadaSchema.parse({
      id,
      nome: fonte.nome,
      url: blob.url,
      formato: fonte.formato,
      mimeType: fonte.mimeType,
      nomeOriginal: nomeArquivo,
      tamanhoBytes: fonte.bytes.byteLength,
      criadoEm: new Date().toISOString(),
    });
    porNome.set(chave, publicada);
    resultado.push(publicada);
  }

  return resultado;
}
