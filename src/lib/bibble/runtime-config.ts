import { BIBBLE_MODEL } from "@/lib/bibble/client";

const DEFAULT_ENDPOINT = "http://127.0.0.1:18080";
export const BIBBLE_CONTEXT_CEILING = 131_072;
export const BIBBLE_OUTPUT_CEILING = Math.max(1_024, Math.min(4_096, Number(process.env.BIBBLE_OUTPUT_TOKEN_LIMIT) || 4_096));
export const BIBBLE_REQUEST_DEADLINE_MS = Math.max(20_000, Math.min(115_000, Number(process.env.BIBBLE_REQUEST_DEADLINE_MS) || 100_000));

export function resolveBibbleEndpoint(raw = process.env.BIBBLE_OLLAMA_URL): URL {
  const url = new URL(raw || DEFAULT_ENDPOINT);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('BIBBLE_OLLAMA_URL inválida');
  }
  url.pathname = url.pathname.replace(/\/$/, '');
  return url;
}

export function getBibbleRuntimeConfig() {
  return {
    endpoint: resolveBibbleEndpoint(),
    model: BIBBLE_MODEL,
    contextWindow: BIBBLE_CONTEXT_CEILING,
    outputTokenLimit: BIBBLE_OUTPUT_CEILING,
    deadlineMs: BIBBLE_REQUEST_DEADLINE_MS,
    concurrency: Math.max(1, Math.min(8, Number(process.env.BIBBLE_MAX_CONCURRENCY) || 1)),
  };
}
