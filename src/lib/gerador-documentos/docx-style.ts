import JSZip from "jszip";

export interface EstiloDocxPdf {
  cabecalhoImagem?: string;
  cabecalhoLargura?: number;
  cabecalhoAltura?: number;
  fonteCorpo?: string;
  tamanhoFonte?: number;
  tamanhoTitulo?: number;
  margemSuperior?: number;
  margemDireita?: number;
  margemInferior?: number;
  margemEsquerda?: number;
}

function atributo(tag: string, nome: string): string | undefined {
  return new RegExp(`\\b${nome}="([^"]+)"`).exec(tag)?.[1];
}

function caminhoWord(alvo: string): string | null {
  const partes = ["word"];
  for (const parte of alvo.replace(/^\//, "").split("/")) {
    if (!parte || parte === ".") continue;
    if (parte === "..") partes.pop();
    else partes.push(parte);
  }
  const caminho = partes.join("/");
  return caminho.startsWith("word/") ? caminho : null;
}

function relacoes(xml: string): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const match of xml.matchAll(/<Relationship\b[^>]*\/?\s*>/g)) {
    const id = atributo(match[0], "Id");
    const alvo = atributo(match[0], "Target");
    if (id && alvo && !/^https?:/i.test(alvo)) mapa.set(id, alvo);
  }
  return mapa;
}

/** Lê somente a apresentação do DOCX; o conteúdo continua vindo das cláusulas do sistema. */
export async function extrairEstiloDocxPdf(buffer: Buffer): Promise<EstiloDocxPdf> {
  const zip = await JSZip.loadAsync(buffer);
  const documento = await zip.file("word/document.xml")?.async("string");
  if (!documento) throw new Error("DOCX sem documento principal");

  const estilo: EstiloDocxPdf = {};
  const fontes = [...documento.matchAll(/<w:rFonts\b[^>]*\/?\s*>/g)]
    .map((match) => atributo(match[0], "w:ascii") ?? atributo(match[0], "w:hAnsi"))
    .filter((fonte): fonte is string => Boolean(fonte));
  if (fontes.length) {
    estilo.fonteCorpo = [...new Set(fontes)].sort(
      (a, b) => fontes.filter((fonte) => fonte === b).length - fontes.filter((fonte) => fonte === a).length,
    )[0];
  }
  const estilosXml = await zip.file("word/styles.xml")?.async("string");
  const padrao = /<w:docDefaults\b[\s\S]*?<\/w:docDefaults>/.exec(estilosXml ?? "")?.[0] ?? "";
  const tamanhoPadrao = Number(/<w:sz\b[^>]*w:val="(\d+)"/.exec(padrao)?.[1]);
  if (Number.isFinite(tamanhoPadrao) && tamanhoPadrao > 0) estilo.tamanhoFonte = tamanhoPadrao / 2;
  const tamanhoTitulo = Number(/<w:sz\b[^>]*w:val="(\d+)"/.exec(documento)?.[1]);
  if (Number.isFinite(tamanhoTitulo) && tamanhoTitulo > 0) estilo.tamanhoTitulo = tamanhoTitulo / 2;

  const margens = /<w:pgMar\b[^>]*\/?\s*>/.exec(documento)?.[0];
  if (margens) {
    for (const [atributoDocx, campo] of [
      ["top", "margemSuperior"], ["right", "margemDireita"],
      ["bottom", "margemInferior"], ["left", "margemEsquerda"],
    ] as const) {
      const twips = Number(atributo(margens, `w:${atributoDocx}`));
      if (Number.isFinite(twips) && twips > 0) estilo[campo] = twips / 20;
    }
  }

  const relsDoc = await zip.file("word/_rels/document.xml.rels")?.async("string");
  if (!relsDoc) return estilo;
  const refs = [...documento.matchAll(/<w:headerReference\b[^>]*\/?\s*>/g)];
  const referencia = refs.find((match) => atributo(match[0], "w:type") === "default") ?? refs[0];
  const headerId = referencia && atributo(referencia[0], "r:id");
  const headerPath = headerId && caminhoWord(relacoes(relsDoc).get(headerId) ?? "");
  if (!headerPath) return estilo;
  const headerXml = await zip.file(headerPath)?.async("string");
  if (!headerXml) return estilo;
  const embed = /<a:blip\b[^>]*\br:embed="([^"]+)"/.exec(headerXml)?.[1];
  if (!embed) return estilo;
  const relsPath = headerPath.replace(/([^/]+)$/, "_rels/$1.rels");
  const relsHeader = await zip.file(relsPath)?.async("string");
  const imagemPath = relsHeader && caminhoWord(relacoes(relsHeader).get(embed) ?? "");
  const imagem = imagemPath && zip.file(imagemPath);
  if (!imagem) return estilo;
  const tipo = imagemPath?.toLowerCase().endsWith(".png") ? "image/png" : imagemPath?.toLowerCase().endsWith(".jpg") || imagemPath?.toLowerCase().endsWith(".jpeg") ? "image/jpeg" : null;
  if (!tipo) return estilo;
  estilo.cabecalhoImagem = `data:${tipo};base64,${(await imagem.async("nodebuffer")).toString("base64")}`;
  const extent = /<wp:extent\b[^>]*\/?\s*>/.exec(headerXml)?.[0];
  const largura = Number(extent && atributo(extent, "cx"));
  const altura = Number(extent && atributo(extent, "cy"));
  if (Number.isFinite(largura) && largura > 0) estilo.cabecalhoLargura = largura / 12700;
  if (Number.isFinite(altura) && altura > 0) estilo.cabecalhoAltura = altura / 12700;
  return estilo;
}

export async function carregarEstiloDocxPdf(url: string | null | undefined): Promise<EstiloDocxPdf | undefined> {
  if (!url || !/^https:\/\/[^/]+\.blob\.vercel-storage\.com\//i.test(url)) return undefined;
  const resposta = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!resposta.ok) throw new Error(`Falha ao carregar DOCX do template (${resposta.status})`);
  return extrairEstiloDocxPdf(Buffer.from(await resposta.arrayBuffer()));
}
