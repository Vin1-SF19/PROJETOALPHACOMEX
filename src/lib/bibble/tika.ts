/**
 * Extração de texto via Apache Tika.
 * URL configurada em TIKA_SERVER_URL (ex: https://tika.alpha-comex.com via Cloudflare).
 * Suporta PDF, DOCX, XLSX, PPTX, ODF, e dezenas de outros formatos.
 * Fallback automático para pdf-parse v2 se o Tika estiver indisponível
 * (cobre o caso do túnel Cloudflare estar fora do ar — PDFs continuam sendo lidos).
 * Se ainda assim não sair texto (PDF de imagem/scan sem camada de texto),
 * fallback final via OCR real na API PDF24 — ver pdf24-ocr.ts.
 */

import { pdfjsWorkerReady } from "./pdfjs-polyfill";
import { ocrViaPdf24, isPdf24Configured } from "./pdf24-ocr";
import { fetchTrustedBibbleBlob } from "./attachment-security";

const TIKA_URL = (process.env.TIKA_SERVER_URL ?? "http://192.168.35.113:9998").replace(/\/+$/, "");
const TIKA_TIMEOUT_MS = 30_000;

/** Considera "sem texto útil" descontando os marcadores de página do pdf-parse ("-- N of M --"). */
function textoInsuficiente(texto: string): boolean {
  return texto.replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "").trim().length < 20;
}

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
  await pdfjsWorkerReady;
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
): Promise<{ text: string; source: "tika" | "pdf-parse" | "pdf24-ocr" | "unsupported" }> {
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
    if (text && !textoInsuficiente(text)) {
      console.info("[BIBBLE PDF] extraction", { source: "tika", extractedChars: text.length });
      return { text, source: "tika" };
    }
  } catch {
    console.warn("[BIBBLE PDF] extraction-fallback", { failedSource: "tika", nextSource: "pdf-parse" });
  }

  // Fallback pdf-parse (só para PDFs)
  if (isPdf) {
    try {
      const text = await extractViaPdfParse(buffer);
      if (text && !textoInsuficiente(text)) {
        console.info("[BIBBLE PDF] extraction", { source: "pdf-parse", extractedChars: text.length });
        return { text, source: "pdf-parse" };
      }
      console.warn("[BIBBLE PDF] extraction-fallback", { failedSource: "pdf-parse", nextSource: "pdf24-ocr", extractedChars: text.length });
    } catch {
      console.warn("[BIBBLE PDF] extraction-fallback", { failedSource: "pdf-parse", nextSource: "pdf24-ocr" });
    }

    // Último recurso: PDF sem camada de texto (scan/imagem) — OCR real via PDF24
    if (isPdf24Configured()) {
      try {
        console.info("[BIBBLE PDF] extraction-attempt", { source: "pdf24-ocr" });
        const bufferOcr = await ocrViaPdf24(buffer, fileName);
        const text = await extractViaTika(bufferOcr, "application/pdf");
        if (text && !textoInsuficiente(text)) {
          console.info("[BIBBLE PDF] extraction", { source: "pdf24-ocr", extractedChars: text.length });
          return { text, source: "pdf24-ocr" };
        }
        console.warn("[BIBBLE PDF] extraction-empty", { source: "pdf24-ocr", extractedChars: text.length });
      } catch {
        console.warn("[BIBBLE PDF] extraction-failed", { source: "pdf24-ocr" });
      }
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
): Promise<{ text: string; source: "tika" | "pdf-parse" | "pdf24-ocr" | "unsupported" }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetchTrustedBibbleBlob(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ao baixar ${fileName}`);
    const arrayBuffer = await res.arrayBuffer();
    return extractTextFromBuffer(Buffer.from(arrayBuffer), mimeType, fileName);
  } finally {
    clearTimeout(timer);
  }
}
