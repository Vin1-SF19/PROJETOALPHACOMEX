/**
 * Renderização HTML→PDF via @react-pdf/renderer.
 *
 * Abordagem (blueprint RM-2026-94CBF6): extrai o conteúdo textual do HTML
 * (parágrafos, títulos, tabelas) e renderiza em PDF A4 com formatação
 * profissional. Não usa puppeteer/playwright (incompatível com Vercel serverless).
 *
 * O HTML de entrada é o mesmo gerado por `renderHtmlComVariaveis` —
 * estrutura simples (p, h1-h6, table, ul/ol, strong, em) vinda do Tika.
 */

import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, lineHeight: 1.5 },
  h1: { fontSize: 16, fontWeight: "bold", marginBottom: 12 },
  h2: { fontSize: 14, fontWeight: "bold", marginBottom: 10 },
  h3: { fontSize: 12, fontWeight: "bold", marginBottom: 8 },
  paragraph: { marginBottom: 10, textAlign: "justify" as const },
  table: { marginBottom: 12 },
  tableRow: { flexDirection: "row" as const, borderBottom: "0.5 solid #E2E8F0" },
  tableCell: { padding: 4, flex: 1, fontSize: 9 },
  tableHeaderCell: { padding: 4, flex: 1, fontSize: 9, fontWeight: "bold" as const },
  listItem: { marginBottom: 4, paddingLeft: 12 },
  rodape: { position: "absolute" as const, bottom: 24, left: 40, fontSize: 7, color: "#64748B" },
});

/** Remove tags HTML e retorna o texto puro, preservando quebras de parágrafo. */
function htmlParaBlocos(html: string): Array<{ tipo: "h1" | "h2" | "h3" | "p" | "li" | "table"; texto: string; celulas?: string[][] }> {
  const blocos: Array<{ tipo: "h1" | "h2" | "h3" | "p" | "li" | "table"; texto: string; celulas?: string[][] }> = [];

  // Extrai tabelas primeiro (antes de remover tags)
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let htmlSemTabelas = html;

  htmlSemTabelas = html.replace(tableRegex, (match, inner) => {
    const rows: string[][] = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(inner)) !== null) {
      const cells: string[] = [];
      const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        cells.push(cellMatch[1].replace(/<[^>]*>/g, "").trim());
      }
      if (cells.length > 0) rows.push(cells);
    }
    if (rows.length > 0) {
      blocos.push({ tipo: "table", texto: "", celulas: rows });
    }
    return ""; // remove da string principal
  });

  // Remove todas as tags restantes
  const textoLimpo = htmlSemTabelas
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Divide em blocos por quebras de parágrafo
  const paragrafos = textoLimpo.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  for (const paragrafo of paragrafos) {
    const linhas = paragrafo.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const linha of linhas) {
      if (/^[-•]\s/.test(linha)) {
        blocos.push({ tipo: "li", texto: linha.replace(/^[-•]\s/, "") });
      } else {
        blocos.push({ tipo: "p", texto: linha });
      }
    }
  }

  return blocos;
}

function formatarDataAtual(): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(new Date());
}

function PdfHtmlDocument({ blocos }: { blocos: Array<{ tipo: string; texto: string; celulas?: string[][] }> }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {blocos.map((bloco, i) => {
          if (bloco.tipo === "table" && bloco.celulas) {
            return (
              <View key={i} style={styles.table}>
                {bloco.celulas.map((row, ri) => (
                  <View key={ri} style={styles.tableRow}>
                    {row.map((cell, ci) => (
                      <Text key={ci} style={ri === 0 ? styles.tableHeaderCell : styles.tableCell}>
                        {cell}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            );
          }
          if (bloco.tipo === "li") {
            return (
              <Text key={i} style={styles.listItem}>
                {"•  "}{bloco.texto}
              </Text>
            );
          }
          return (
            <Text key={i} style={styles.paragraph}>
              {bloco.texto}
            </Text>
          );
        })}
        <Text style={styles.rodape}>Documento gerado em {formatarDataAtual()}</Text>
      </Page>
    </Document>
  );
}

/**
 * Converte HTML em PDF (Buffer).
 *
 * @param html - HTML com variáveis já substituídas (saída de `renderHtmlComVariaveis`)
 * @param options - opções de página (reservado para uso futuro)
 * @returns Buffer com o PDF (header `%PDF`)
 * @throws Error se o HTML for vazio ou a renderização falhar
 */
export async function renderHtmlParaPdf(
  html: string,
  _options?: { pageSize?: string; margin?: string },
): Promise<Buffer> {
  if (!html || !html.trim()) {
    throw new Error("HTML vazio — não é possível gerar PDF");
  }

  const blocos = htmlParaBlocos(html);
  if (blocos.length === 0) {
    throw new Error("HTML não contém conteúdo textual reconhecível");
  }

  const buffer = await renderToBuffer(<PdfHtmlDocument blocos={blocos} />);
  return Buffer.from(buffer);
}
