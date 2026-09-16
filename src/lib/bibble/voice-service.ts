import "server-only";

import { z } from "zod";

export const BIBBLE_VOICE_REQUEST_MAX_BYTES = 16 * 1024;
export const BIBBLE_VOICE_AUDIO_MAX_BYTES = 25 * 1024 * 1024;
export const BIBBLE_VOICE_TIMEOUT_MS = 570_000;

export const bibbleVoiceSpeechSchema = z.object({
  text: z.string().trim().min(1).max(2_500),
  voice: z.literal("bibble").default("bibble"),
  language: z.literal("pt").default("pt"),
}).strict();

export type BibbleVoiceSpeechInput = z.infer<typeof bibbleVoiceSpeechSchema>;

export class BibbleVoiceProxyError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BibbleVoiceProxyError";
  }
}

export function assertBibbleVoiceSameOrigin(request: Request): void {
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  if (!host || !origin) throw new BibbleVoiceProxyError(403, "INVALID_ORIGIN", "Origem obrigatória");

  let parsedOrigin: URL;
  let parsedHost: URL;
  try {
    parsedOrigin = new URL(origin);
    parsedHost = new URL(`http://${host}`);
  } catch {
    throw new BibbleVoiceProxyError(403, "INVALID_ORIGIN", "Origem inválida");
  }

  const hostIsAuthorityOnly = parsedHost.pathname === "/"
    && parsedHost.search === ""
    && parsedHost.hash === ""
    && parsedHost.username === ""
    && parsedHost.password === ""
    && parsedHost.host.length > 0;
  if (!hostIsAuthorityOnly) {
    throw new BibbleVoiceProxyError(403, "INVALID_ORIGIN", "Origem inválida");
  }

  if (parsedOrigin.host.toLocaleLowerCase("en-US") !== parsedHost.host.toLocaleLowerCase("en-US")) {
    throw new BibbleVoiceProxyError(403, "INVALID_ORIGIN", "Origem não permitida");
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    throw new BibbleVoiceProxyError(403, "CROSS_SITE_REQUEST", "Requisição cross-site não permitida");
  }
}

export function resolveBibbleVoiceConfig(env: Partial<Record<string, string | undefined>> = process.env): {
  baseUrl: URL;
  token: string | null;
} {
  const raw = env.BIBBLE_VOICE_URL?.trim() || "http://127.0.0.1:8787";
  let baseUrl: URL;
  try {
    baseUrl = new URL(raw);
  } catch {
    throw new BibbleVoiceProxyError(503, "VOICE_MISCONFIGURED", "Serviço de voz não configurado");
  }
  if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) {
    throw new BibbleVoiceProxyError(503, "VOICE_MISCONFIGURED", "Serviço de voz não configurado");
  }
  const isLoopback = ["127.0.0.1", "localhost", "::1"].includes(baseUrl.hostname);
  const token = env.BIBBLE_VOICE_TOKEN?.trim() || null;
  if (!isLoopback && (baseUrl.protocol !== "https:" || !token)) {
    throw new BibbleVoiceProxyError(503, "VOICE_MISCONFIGURED", "Conexão privada de voz indisponível");
  }
  baseUrl.pathname = baseUrl.pathname.replace(/\/$/, "");
  baseUrl.search = "";
  baseUrl.hash = "";
  return { baseUrl, token };
}

export function resolveBibbleVoiceEndpoint(baseUrl: URL, endpointPath: string): URL {
  const endpointSegments = endpointPath.split("/");
  const isSafeAbsolutePath = endpointPath.startsWith("/")
    && !endpointPath.startsWith("//")
    && !endpointPath.includes("\\")
    && !endpointPath.includes("?")
    && !endpointPath.includes("#")
    && endpointSegments.every((segment) => segment !== "." && segment !== "..");
  if (!isSafeAbsolutePath) {
    throw new BibbleVoiceProxyError(503, "VOICE_MISCONFIGURED", "Endpoint de voz inválido");
  }

  const endpointUrl = new URL(baseUrl.toString());
  const basePath = endpointUrl.pathname.replace(/\/+$/, "");
  endpointUrl.pathname = `${basePath}${endpointPath}`;
  endpointUrl.search = "";
  endpointUrl.hash = "";
  if (endpointUrl.origin !== baseUrl.origin) {
    throw new BibbleVoiceProxyError(503, "VOICE_MISCONFIGURED", "Endpoint de voz inválido");
  }
  return endpointUrl;
}

export function bibbleVoiceHeaders(token: string | null, accept: string): HeadersInit {
  return {
    Accept: accept,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function isWav(bytes: Uint8Array): boolean {
  return bytes.length >= 12
    && String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.subarray(8, 12)) === "WAVE";
}

export async function readBibbleVoiceAudio(response: Response): Promise<Uint8Array> {
  const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "audio/wav" && contentType !== "audio/x-wav" && contentType !== "audio/wave") {
    throw new BibbleVoiceProxyError(502, "INVALID_VOICE_RESPONSE", "Resposta de voz inválida");
  }
  const declaredHeader = response.headers.get("content-length");
  if (declaredHeader !== null) {
    const declared = Number(declaredHeader);
    if (!Number.isSafeInteger(declared) || declared <= 0 || declared > BIBBLE_VOICE_AUDIO_MAX_BYTES) {
      throw new BibbleVoiceProxyError(502, "INVALID_VOICE_RESPONSE", "Resposta de voz inválida");
    }
  }
  if (!response.body) {
    throw new BibbleVoiceProxyError(502, "INVALID_VOICE_RESPONSE", "Resposta de voz inválida");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > BIBBLE_VOICE_AUDIO_MAX_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new BibbleVoiceProxyError(502, "INVALID_VOICE_RESPONSE", "Resposta de voz inválida");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  if (!isWav(bytes)) {
    throw new BibbleVoiceProxyError(502, "INVALID_VOICE_RESPONSE", "Resposta de voz inválida");
  }
  return bytes;
}
