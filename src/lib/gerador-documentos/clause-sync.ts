interface ResultadoSubstituicaoClausula {
  html: string;
  substituida: boolean;
}

const TAG_OU_TEXTO = /<!--[\s\S]*?-->|<[^>]+>|[^<]+/g;

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodificarEntidades(valor: string): string {
  return valor
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, codigo: string) => String.fromCodePoint(Number(codigo)))
    .replace(/&#x([\da-f]+);/gi, (_match, codigo: string) =>
      String.fromCodePoint(Number.parseInt(codigo, 16)),
    );
}

function normalizarTexto(valor: string): string {
  return decodificarEntidades(valor).replace(/\s+/g, " ").trim();
}

/**
 * Substitui somente nós de texto correspondentes à cláusula, preservando todas
 * as tags do HTML fiel. Isso também funciona quando os grifos de variáveis
 * dividiram o texto entre vários nós (`<mark>`).
 */
export function substituirClausulaNoHtml(
  html: string,
  textoAnterior: string,
  novoTexto: string,
): ResultadoSubstituicaoClausula {
  const alvo = normalizarTexto(textoAnterior);
  if (!alvo || !novoTexto.trim()) return { html, substituida: false };

  const tokens = html.match(TAG_OU_TEXTO) ?? [];
  const indicesTexto: number[] = [];
  let tagIgnorada: "script" | "style" | null = null;

  tokens.forEach((token, indice) => {
    if (token.startsWith("<")) {
      const abertura = /^<(script|style)\b/i.exec(token)?.[1]?.toLowerCase();
      const fechamento = /^<\/(script|style)\b/i.exec(token)?.[1]?.toLowerCase();
      if (abertura === "script" || abertura === "style") tagIgnorada = abertura;
      if (fechamento === tagIgnorada) tagIgnorada = null;
      return;
    }
    if (!tagIgnorada && normalizarTexto(token)) indicesTexto.push(indice);
  });

  for (const indice of indicesTexto) {
    const ocorrenciaLiteral = tokens[indice].indexOf(textoAnterior);
    if (ocorrenciaLiteral >= 0) {
      tokens[indice] =
        tokens[indice].slice(0, ocorrenciaLiteral) +
        escaparHtml(novoTexto) +
        tokens[indice].slice(ocorrenciaLiteral + textoAnterior.length);
      return { html: tokens.join(""), substituida: true };
    }
  }

  for (let inicio = 0; inicio < indicesTexto.length; inicio += 1) {
    let textoAcumulado = "";
    for (let fim = inicio; fim < indicesTexto.length; fim += 1) {
      textoAcumulado += tokens[indicesTexto[fim]];
      const normalizado = normalizarTexto(textoAcumulado);
      if (normalizado === alvo) {
        tokens[indicesTexto[inicio]] = escaparHtml(novoTexto);
        for (let i = inicio + 1; i <= fim; i += 1) tokens[indicesTexto[i]] = "";
        return { html: tokens.join(""), substituida: true };
      }
      if (normalizado.length > alvo.length * 1.5 + 100) break;
    }
  }

  return { html, substituida: false };
}

/** Fallback para documentos manuais/legados que ainda não possuem HTML fiel. */
export function criarHtmlDeClausulas(
  titulo: string,
  clausulas: Array<{ titulo: string; conteudo: string }>,
): string {
  const corpo = clausulas
    .map(
      (clausula) =>
        `<section><h2>${escaparHtml(clausula.titulo)}</h2><p>${escaparHtml(clausula.conteudo).replace(/\n/g, "<br>")}</p></section>`,
    )
    .join("\n");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escaparHtml(titulo)}</title></head><body><h1>${escaparHtml(titulo)}</h1>${corpo}</body></html>`;
}

/**
 * Enquanto `htmlUrl` não faz parte do schema, o PDF funciona como ponte
 * persistida para o HTML irmão: ambos usam o mesmo host, usuário, documento e
 * revisão no Vercel Blob. Retorna null para URLs antigas sem artefato HTML.
 */
export function derivarHtmlUrlDoPdf(pdfUrl: string | null | undefined): string | null {
  if (!pdfUrl) return null;
  try {
    const url = new URL(pdfUrl);
    if (url.pathname.includes("/gerador-documentos/documentos-pdf/")) {
      url.pathname = url.pathname
        .replace("/gerador-documentos/documentos-pdf/", "/gerador-documentos/documentos-html/")
        .replace(/\.pdf$/, ".html");
      return url.toString();
    }
    if (url.pathname.includes("/gerador-documentos/pdfs-gerados/")) {
      url.pathname = url.pathname
        .replace("/gerador-documentos/pdfs-gerados/", "/gerador-documentos/documentos-html/")
        .replace(/\.pdf$/, ".html");
      return url.toString();
    }
  } catch {
    return null;
  }
  return null;
}
