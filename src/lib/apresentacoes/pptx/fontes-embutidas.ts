import type JSZip from "jszip";
import { comoArray, resolverCaminhoRelativo, type MapaRelacionamentos, type NoXml } from "./xml-utils";

export interface FonteEmbutidaPptx {
  nome: string;
  bytes: Uint8Array;
  formato: "truetype" | "opentype";
  mimeType: "font/ttf" | "font/otf";
  nomeArquivo: string;
}

function assinaturaSfnt(bytes: Uint8Array, offset = 0): FonteEmbutidaPptx["formato"] | null {
  if (bytes.byteLength < offset + 4) return null;
  const ascii = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
  if (ascii === "OTTO") return "opentype";
  if (ascii === "true" || (bytes[offset] === 0 && bytes[offset + 1] === 1 && bytes[offset + 2] === 0 && bytes[offset + 3] === 0)) {
    return "truetype";
  }
  return null;
}

/**
 * O PowerPoint guarda fontes incorporadas como EOT (`.fntdata`). O payload SFNT original fica
 * no fim do arquivo e seu tamanho está no cabeçalho EOT. Extraímos somente esse TTF/OTF, que é
 * o formato aceito pelos browsers modernos. Arquivos já-SFNT também são aceitos defensivamente.
 */
export function extrairSfntDeFontePowerPoint(conteudo: Uint8Array): {
  bytes: Uint8Array;
  formato: FonteEmbutidaPptx["formato"];
} | null {
  const direto = assinaturaSfnt(conteudo);
  if (direto) return { bytes: conteudo, formato: direto };
  if (conteudo.byteLength < 12) return null;

  const view = new DataView(conteudo.buffer, conteudo.byteOffset, conteudo.byteLength);
  const tamanhoEot = view.getUint32(0, true);
  const tamanhoFonte = view.getUint32(4, true);
  if (tamanhoEot > conteudo.byteLength || tamanhoFonte <= 0 || tamanhoFonte > tamanhoEot) return null;
  const offset = tamanhoEot - tamanhoFonte;
  const formato = assinaturaSfnt(conteudo, offset);
  if (!formato) return null;
  return { bytes: conteudo.slice(offset, offset + tamanhoFonte), formato };
}

/** Extrai todas as faces incorporadas declaradas em `p:embeddedFontLst`. */
export async function extrairFontesEmbutidasPptx(
  zip: JSZip,
  presentationXml: NoXml,
  relacionamentos: MapaRelacionamentos,
): Promise<FonteEmbutidaPptx[]> {
  const lista = comoArray<NoXml>(presentationXml?.["p:presentation"]?.["p:embeddedFontLst"]?.["p:embeddedFont"]);
  const saida: FonteEmbutidaPptx[] = [];
  const faces = ["p:regular", "p:bold", "p:italic", "p:boldItalic"] as const;

  for (const item of lista) {
    const nome = String(item?.["p:font"]?.["@_typeface"] ?? "").trim();
    if (!nome) continue;
    for (const face of faces) {
      const relationshipId = item?.[face]?.["@_r:id"];
      if (typeof relationshipId !== "string") continue;
      const alvo = relacionamentos[relationshipId];
      if (!alvo) continue;
      const caminho = resolverCaminhoRelativo("ppt/presentation.xml", alvo);
      const arquivo = zip.file(caminho);
      if (!arquivo) continue;
      const fonte = extrairSfntDeFontePowerPoint(await arquivo.async("uint8array"));
      if (!fonte) continue;
      const extensao = fonte.formato === "opentype" ? "otf" : "ttf";
      saida.push({
        nome,
        bytes: fonte.bytes,
        formato: fonte.formato,
        mimeType: fonte.formato === "opentype" ? "font/otf" : "font/ttf",
        nomeArquivo: `${relationshipId}-${face.slice(2)}.${extensao}`,
      });
    }
  }

  return saida;
}
