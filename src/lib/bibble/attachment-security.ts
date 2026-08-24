import { z } from "zod";
import { BIBBLE_MAX_FILES_PER_TURN, isAllowedBibbleAttachmentType } from "./attachments";

export {
  BIBBLE_ALLOWED_ATTACHMENT_TYPES,
  BIBBLE_MAX_FILES_PER_TURN,
  isAllowedBibbleAttachmentType,
} from "./attachments";

export const BIBBLE_ATTACHMENT_MAX_BYTES = 100 * 1024 * 1024;
// Teto de extração aplicado no MOMENTO DO UPLOAD, antes do orçamento por
// arquivo do chat (context-budget.ts). Servidor Ollama roda em GPU com VRAM
// alta — subido de 30k para acompanhar a mesma margem de anexo do chat
// (BIBBLE_ATTACHMENT_CONTEXT_WINDOW), senão o upload cortava o PDF antes do
// chat ter chance de usar o orçamento maior.
export const BIBBLE_UPLOAD_TEXT_TOKEN_BUDGET =
  Number(process.env.BIBBLE_UPLOAD_TEXT_TOKEN_BUDGET) || 120_000;
export const BIBBLE_UPLOAD_TEXT_MAX_CHARS = BIBBLE_UPLOAD_TEXT_TOKEN_BUDGET * 4;
export const BIBBLE_CHAT_MESSAGE_MAX_CHARS = 100_000;
export const BIBBLE_HISTORY_ENVELOPE_OVERHEAD_CHARS = 32_768;
export const BIBBLE_HISTORY_MESSAGE_MAX_CHARS =
  BIBBLE_CHAT_MESSAGE_MAX_CHARS
  + BIBBLE_UPLOAD_TEXT_MAX_CHARS * BIBBLE_MAX_FILES_PER_TURN
  + BIBBLE_HISTORY_ENVELOPE_OVERHEAD_CHARS;
export const BIBBLE_HISTORY_TOTAL_MAX_CHARS = 6 * 1024 * 1024;
export const BIBBLE_CHAT_REQUEST_MAX_BYTES = 8 * 1024 * 1024;

export class BibblePayloadTooLargeError extends Error {
  constructor() {
    super("Payload do chat excede o limite permitido");
    this.name = "BibblePayloadTooLargeError";
  }
}

export async function readRequestTextWithLimit(
  request: Request,
  maxBytes = BIBBLE_CHAT_REQUEST_MAX_BYTES,
): Promise<string> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new BibblePayloadTooLargeError();
  }
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new BibblePayloadTooLargeError();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export function hasPdfMagicBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 4
    && bytes[0] === 0x25
    && bytes[1] === 0x50
    && bytes[2] === 0x44
    && bytes[3] === 0x46;
}

export function parseTrustedBibbleBlobUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    const decodedPath = decodeURIComponent(url.pathname);
    if (
      url.protocol !== "https:"
      || !url.hostname.endsWith(".blob.vercel-storage.com")
      || url.username
      || url.password
      || url.port
      || !url.pathname.startsWith("/bibble-chat/")
      || !decodedPath.startsWith("/bibble-chat/")
      || decodedPath.split("/").includes("..")
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export async function fetchTrustedBibbleBlob(
  value: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = parseTrustedBibbleBlobUrl(value);
  if (!url) throw new Error("URL de anexo não permitida");

  const response = await fetch(url, { ...init, redirect: "manual" });
  if (response.status >= 300 && response.status < 400) {
    throw new Error("Redirecionamento de anexo bloqueado");
  }
  if (response.url && !parseTrustedBibbleBlobUrl(response.url)) {
    throw new Error("Resposta de anexo fora da origem permitida");
  }
  return response;
}

const historyMessageSchema = z.object({
  role: z.enum(["user", "bibble"]),
  text: z.string().max(BIBBLE_HISTORY_MESSAGE_MAX_CHARS),
}).strict();

const historySchema = z.array(historyMessageSchema).max(200).superRefine((history, ctx) => {
  const totalChars = history.reduce((total, message) => total + message.text.length, 0);
  if (totalChars > BIBBLE_HISTORY_TOTAL_MAX_CHARS) {
    ctx.addIssue({ code: "custom", message: "Histórico excede o limite agregado permitido" });
  }
});

const fileInputSchema = z.object({
  name: z.string().trim().min(1).max(255),
  type: z.string().trim().min(1).max(150).refine(isAllowedBibbleAttachmentType, "Tipo de anexo não permitido"),
  size: z.number().int().nonnegative().max(BIBBLE_ATTACHMENT_MAX_BYTES),
  url: z.string().url().max(2_048).refine((url) => parseTrustedBibbleBlobUrl(url) !== null, "URL de anexo não permitida").optional(),
  extractedContent: z.string().max(BIBBLE_UPLOAD_TEXT_MAX_CHARS).optional(),
  extractionSource: z.enum(["tika", "pdf-parse", "pdf24-ocr", "unsupported"]).optional(),
}).strict();

const contextSchema = z.record(z.string().max(128), z.unknown()).superRefine((value, ctx) => {
  if (JSON.stringify(value).length > 20_000) {
    ctx.addIssue({ code: "custom", message: "Contexto excede o limite permitido" });
  }
});

export const bibbleChatInputSchema = z.object({
  message: z.string().max(BIBBLE_CHAT_MESSAGE_MAX_CHARS).default(""),
  history: historySchema.default([]),
  context: contextSchema.optional(),
  model: z.string().trim().min(1).max(200).optional(),
  sessionId: z.string().trim().min(1).max(128).optional(),
  files: z.array(fileInputSchema).max(BIBBLE_MAX_FILES_PER_TURN).optional(),
  temperature: z.number().finite().min(0).max(2).optional(),
  computerAccess: z.boolean().optional(),
  globalSystemPrompt: z.string().max(30_000).optional(),
  contextWindow: z.number().int().min(512).max(262_144).optional(),
}).strict();

export type BibbleChatInput = z.infer<typeof bibbleChatInputSchema>;
