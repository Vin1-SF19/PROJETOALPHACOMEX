/** Renderização HTML→PDF serverless via @react-pdf/renderer. */
import React from "react";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

interface CelulaTabela { texto: string; cabecalho: boolean; colspan: number }
interface LinhaTabela { celulas: CelulaTabela[] }
export type BlocoHtmlPdf =
  | { tipo: "h1" | "h2" | "h3" | "p" | "li"; texto: string }
  | { tipo: "image"; src: string; alt: string; largura?: number }
  | { tipo: "table"; linhas: LinhaTabela[]; totalColunas: number };
export interface DocumentoHtmlPdf { cabecalho: BlocoHtmlPdf[]; conteudo: BlocoHtmlPdf[]; rodape: BlocoHtmlPdf[] }

const styles = StyleSheet.create({
  page: { paddingTop: 78, paddingRight: 40, paddingBottom: 58, paddingLeft: 40, fontFamily: "Helvetica", fontSize: 10, lineHeight: 1.45 },
  pageSemCabecalho: { paddingTop: 40 },
  header: { position: "absolute", top: 20, left: 40, right: 40, minHeight: 38, paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: "#CBD5E1", flexDirection: "row", alignItems: "center", gap: 8 },
  footer: { position: "absolute", bottom: 20, left: 40, right: 40, minHeight: 20, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: "#CBD5E1", flexDirection: "row", alignItems: "center", gap: 8 },
  headerText: { flexGrow: 1, fontSize: 8, color: "#475569" },
  footerText: { flexGrow: 1, fontSize: 7, color: "#64748B" },
  headerImage: { width: 64, height: 32, objectFit: "contain" },
  footerImage: { width: 48, height: 20, objectFit: "contain" },
  h1: { fontSize: 16, fontWeight: "bold", marginBottom: 12 },
  h2: { fontSize: 14, fontWeight: "bold", marginBottom: 10 },
  h3: { fontSize: 12, fontWeight: "bold", marginBottom: 8 },
  paragraph: { marginBottom: 9, textAlign: "justify" },
  listItem: { marginBottom: 4, paddingLeft: 12 },
  image: { maxWidth: 515, maxHeight: 360, objectFit: "contain", marginBottom: 10 },
  table: { width: "100%", marginBottom: 12, borderTopWidth: 0.75, borderLeftWidth: 0.75, borderColor: "#94A3B8" },
  tableRow: { flexDirection: "row" },
  tableCell: { minHeight: 24, paddingVertical: 5, paddingHorizontal: 6, borderRightWidth: 0.75, borderBottomWidth: 0.75, borderColor: "#94A3B8", fontSize: 8.5 },
  tableHeaderCell: { backgroundColor: "#F1F5F9", fontWeight: "bold" },
});

function textoHtml(valor: string): string {
  return valor.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&#(\d+);/g, (_m, c: string) => String.fromCodePoint(Number(c)))
    .replace(/&#x([\da-f]+);/gi, (_m, c: string) => String.fromCodePoint(Number.parseInt(c, 16)))
    .replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
}

function atributo(attrs: string, nome: string): string | undefined {
  const quoted = new RegExp(`\\b${nome}\\s*=\\s*(["'])(.*?)\\1`, "i").exec(attrs);
  return quoted?.[2] ?? new RegExp(`\\b${nome}\\s*=\\s*([^\\s>]+)`, "i").exec(attrs)?.[1];
}

function fonteImagem(src?: string): string | null {
  if (!src) return null;
  const valor = src.trim();
  if (/^data:image\/(?:png|jpe?g);base64,[a-z\d+/=\s]+$/i.test(valor)) return valor;
  try {
    const url = new URL(valor);
    if (!/^https?:$/.test(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "::1" || host.endsWith(".local") || /^(?:10|127)\./.test(host) || /^192\.168\./.test(host) || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)) return null;
    return url.toString();
  } catch { return null; }
}

function imagem(attrs: string): BlocoHtmlPdf | null {
  const src = fonteImagem(atributo(attrs, "src"));
  if (!src) return null;
  const width = atributo(attrs, "width") ?? /(?:^|;)\s*width\s*:\s*(\d+(?:\.\d+)?)px/i.exec(atributo(attrs, "style") ?? "")?.[1];
  const px = width ? Number.parseFloat(width) : Number.NaN;
  return { tipo: "image", src, alt: textoHtml(atributo(attrs, "alt") ?? ""), largura: Number.isFinite(px) ? Math.min(515, Math.max(24, px * 0.75)) : undefined };
}

function tabela(inner: string): BlocoHtmlPdf | null {
  const linhas: LinhaTabela[] = [];
  let totalColunas = 0;
  for (const row of inner.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)) {
    const celulas: CelulaTabela[] = [];
    for (const cell of row[1].matchAll(/<(th|td)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi)) {
      const colspan = Math.max(1, Number.parseInt(atributo(cell[2], "colspan") ?? "1", 10) || 1);
      celulas.push({ texto: textoHtml(cell[3]), cabecalho: cell[1].toLowerCase() === "th", colspan });
    }
    if (celulas.length) {
      totalColunas = Math.max(totalColunas, celulas.reduce((soma, celula) => soma + celula.colspan, 0));
      linhas.push({ celulas });
    }
  }
  return linhas.length ? { tipo: "table", linhas, totalColunas } : null;
}

function blocos(html: string): BlocoHtmlPdf[] {
  const saida: BlocoHtmlPdf[] = [];
  for (const match of html.matchAll(/<(table|h[1-6]|p|li)\b[^>]*>([\s\S]*?)<\/\1\s*>|<img\b([^>]*)\/?\s*>/gi)) {
    if (match[3] !== undefined) { const bloco = imagem(match[3]); if (bloco) saida.push(bloco); continue; }
    const tag = match[1].toLowerCase();
    if (tag === "table") { const bloco = tabela(match[2]); if (bloco) saida.push(bloco); continue; }
    const tipo = tag === "li" ? "li" : tag === "h1" ? "h1" : tag === "h2" ? "h2" : tag.startsWith("h") ? "h3" : "p";
    const partes = match[2].split(/(<img\b[^>]*\/?\s*>)/gi);
    for (const parte of partes) {
      const imageMatch = /^<img\b([^>]*)\/?\s*>$/i.exec(parte);
      if (imageMatch) { const bloco = imagem(imageMatch[1]); if (bloco) saida.push(bloco); }
      else { const texto = textoHtml(parte); if (texto) saida.push({ tipo, texto }); }
    }
  }
  if (!saida.length) { const texto = textoHtml(html); if (texto) saida.push({ tipo: "p", texto }); }
  return saida;
}

function extrairRegiao(html: string, regiao: "header" | "footer") {
  const regioes: string[] = [];
  let restante = html.replace(new RegExp(`<${regiao}\\b[^>]*>([\\s\\S]*?)<\\/${regiao}\\s*>`, "gi"), (_m, inner: string) => { regioes.push(inner); return ""; });
  const nomes = regiao === "header" ? "header|page-header|document-header" : "footer|page-footer|document-footer";
  restante = restante.replace(new RegExp(`<(?:div|section)\\b[^>]*class=["'][^"']*\\b(?:${nomes})\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/(?:div|section)\\s*>`, "gi"), (_m, inner: string) => { regioes.push(inner); return ""; });
  return { regioes, restante };
}

/** Estrutura testável usada para validar ordem e presença dos elementos do upload. */
export function analisarHtmlParaPdf(html: string): DocumentoHtmlPdf {
  const cabecalho = extrairRegiao(html, "header");
  const rodape = extrairRegiao(cabecalho.restante, "footer");
  return { cabecalho: cabecalho.regioes.flatMap(blocos), conteudo: blocos(rodape.restante), rodape: rodape.regioes.flatMap(blocos) };
}

function RegiaoFixa({ itens, regiao }: { itens: BlocoHtmlPdf[]; regiao: "header" | "footer" }) {
  /* eslint-disable jsx-a11y/alt-text -- Image é o primitivo PDF, não um elemento HTML. */
  return <View fixed style={regiao === "header" ? styles.header : styles.footer}>{itens.map((item, i) => item.tipo === "image" ? <Image key={i} src={item.src} style={regiao === "header" ? styles.headerImage : styles.footerImage} /> : item.tipo !== "table" ? <Text key={i} style={regiao === "header" ? styles.headerText : styles.footerText}>{item.texto}</Text> : null)}</View>;
}

function Bloco({ item }: { item: BlocoHtmlPdf }) {
  /* eslint-disable jsx-a11y/alt-text -- Image é o primitivo PDF, não um elemento HTML. */
  if (item.tipo === "image") return <Image src={item.src} style={item.largura ? { ...styles.image, width: item.largura } : styles.image} />;
  if (item.tipo === "table") return <View style={styles.table}>{item.linhas.map((linha, ri) => <View key={ri} style={styles.tableRow} wrap={false}>{linha.celulas.map((cell, ci) => <Text key={ci} style={{ ...styles.tableCell, ...(cell.cabecalho ? styles.tableHeaderCell : {}), flexGrow: cell.colspan, flexBasis: 0 }}>{cell.texto}</Text>)}</View>)}</View>;
  if (item.tipo === "li") return <Text style={styles.listItem}>{"•  "}{item.texto}</Text>;
  return <Text style={item.tipo === "p" ? styles.paragraph : styles[item.tipo]}>{item.texto}</Text>;
}

function PdfHtmlDocument({ documento }: { documento: DocumentoHtmlPdf }) {
  return <Document><Page size="A4" style={documento.cabecalho.length ? styles.page : { ...styles.page, ...styles.pageSemCabecalho }}>{documento.cabecalho.length > 0 && <RegiaoFixa itens={documento.cabecalho} regiao="header" />}{documento.conteudo.map((item, i) => <Bloco key={i} item={item} />)}{documento.rodape.length > 0 && <RegiaoFixa itens={documento.rodape} regiao="footer" />}</Page></Document>;
}

export async function renderHtmlParaPdf(html: string): Promise<Buffer> {
  if (!html?.trim()) throw new Error("HTML vazio — não é possível gerar PDF");
  const documento = analisarHtmlParaPdf(html);
  if (!documento.cabecalho.length && !documento.conteudo.length && !documento.rodape.length) throw new Error("HTML não contém conteúdo reconhecível");
  return Buffer.from(await renderToBuffer(<PdfHtmlDocument documento={documento} />));
}
