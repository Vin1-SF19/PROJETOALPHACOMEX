/**
 * Conversão de documento para HTML via Tika (Accept: text/html).
 * O Tika já suporta PDF, DOCX, ODT, RTF, TXT — basta trocar o header Accept.
 * Retorna HTML estruturado (parágrafos, tabelas, listas) suficiente para
 * exibição fiel de documentos de negócio (contratos, propostas).
 */

const TIKA_URL = (process.env.TIKA_SERVER_URL ?? "http://192.168.35.113:9998").replace(/\/+$/, "");
const TIKA_TIMEOUT_MS = 30_000;

/**
 * Converte um buffer de documento em HTML estruturado usando o Tika.
 * Suporta: PDF, DOCX, ODT, RTF, TXT (mesmos formatos do extractTextFromBuffer).
 *
 * @returns HTML string (pode conter tags <p>, <table>, <ul>, <strong>, etc.)
 * @throws Error se o Tika retornar status não-ok ou timeout
 */
export async function converterParaHtml(
  buffer: Buffer,
  mimeType: string,
  _fileName = "arquivo",
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIKA_TIMEOUT_MS);

  try {
    const res = await fetch(`${TIKA_URL}/tika`, {
      method: "PUT",
      signal: ctrl.signal,
      headers: {
        "Content-Type": mimeType || "application/octet-stream",
        Accept: "text/html",
      },
      body: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
    });

    if (!res.ok) {
      throw new Error(`Tika (HTML) retornou ${res.status}`);
    }

    const html = await res.text();
    if (!html.trim()) {
      throw new Error("Tika (HTML) retornou conteúdo vazio");
    }

    return html;
  } finally {
    clearTimeout(timer);
  }
}
