/**
 * Extração de texto via Apache Tika.
 * URL configurada em TIKA_SERVER_URL (ex: https://tika.alpha-comex.com via Cloudflare).
 * Suporta PDF, DOCX, XLSX, PPTX, ODF, e dezenas de outros formatos.
 * Fallback automático para pdf-parse v2 se o Tika estiver indisponível
 * (cobre o caso do túnel Cloudflare estar fora do ar — PDFs continuam sendo lidos).
 */

const TIKA_URL = (process.env.TIKA_SERVER_URL ?? "http://192.168.35.113:9998").replace(/\/+$/, "");
const TIKA_TIMEOUT_MS = 30_000;

/**
 * Envia um Buffer para o Tika e retorna o texto extraído.
 * Lança erro se o Tika retornar status não-ok.
 */
async function extractViaTika(buffer: Buffer, mimeType: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIKA_TIMEOUT_MS);

  try {
    const res = await fetch(`${TIKA_URL}/tika`, {
      method: "PUT",
      signal: ctrl.signal,
      headers: {
        "Content-Type": mimeType,
        Accept: "text/plain",
      },
      body: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
    });

    if (!res.ok) throw new Error(`Tika retornou ${res.status}`);

    const text = await res.text();
    return text.trim();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fallback: pdf-parse v2 para quando o Tika não estiver disponível.
 */
async function extractViaPdfParse(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer, verbosity: 0 });
  const result = await parser.getText();
  await parser.destroy();
  return result.text.trim();
}

/**
 * Extrai texto de qualquer arquivo binário suportado pelo Tika.
 * Se o Tika estiver fora do ar e o arquivo for PDF, usa pdf-parse como fallback.
 *
 * @param buffer  Conteúdo binário do arquivo
 * @param mimeType  MIME type do arquivo (ex: "application/pdf")
 * @param fileName  Nome do arquivo — usado para log
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
  fileName = "arquivo",
): Promise<{ text: string; source: "tika" | "pdf-parse" | "unsupported" }> {
  // Tipos que o Tika manipula bem; outros são binários opacos
  const SUPPORTED = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.oasis.opendocument.text",
    "application/vnd.oasis.opendocument.spreadsheet",
    "text/plain",
    "text/csv",
    "application/json",
    "application/xml",
    "text/xml",
    "text/html",
    "application/rtf",
  ];

  const isPdf = mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
  const isSupported = SUPPORTED.includes(mimeType) || isPdf;

  if (!isSupported) {
    return { text: "", source: "unsupported" };
  }

  // Tenta Tika primeiro
  try {
    const text = await extractViaTika(buffer, mimeType || "application/octet-stream");
    if (text) {
      console.log(`[TIKA] ${fileName}: ${text.length} chars extraídos`);
      return { text, source: "tika" };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[TIKA] Falha ao processar ${fileName}: ${msg}. Tentando fallback...`);
  }

  // Fallback pdf-parse (só para PDFs)
  if (isPdf) {
    try {
      const text = await extractViaPdfParse(buffer);
      console.log(`[PDF-PARSE fallback] ${fileName}: ${text.length} chars extraídos`);
      return { text, source: "pdf-parse" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[PDF-PARSE fallback] Falha em ${fileName}: ${msg}`);
    }
  }

  return { text: "", source: "unsupported" };
}

/**
 * Versão para quando já temos a URL do arquivo (Vercel Blob público).
 * Baixa e passa para extractTextFromBuffer.
 */
export async function extractTextFromUrl(
  url: string,
  mimeType: string,
  fileName = "arquivo",
  timeoutMs = 15_000,
): Promise<{ text: string; source: "tika" | "pdf-parse" | "unsupported" }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ao baixar ${fileName}`);
    const arrayBuffer = await res.arrayBuffer();
    return extractTextFromBuffer(Buffer.from(arrayBuffer), mimeType, fileName);
  } finally {
    clearTimeout(timer);
  }
}
