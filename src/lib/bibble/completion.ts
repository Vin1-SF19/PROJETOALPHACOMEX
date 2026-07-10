import { getProvider, getProviderConfig } from "./client";
import type { OllamaTool } from "./tools";

/** Codifica um evento como frame SSE (`data: {...}\n\n`) — formato compartilhado por todas as rotas de streaming do projeto. */
export function encodeSSE<T>(event: T, enc: TextEncoder): Uint8Array {
  return enc.encode(`data: ${JSON.stringify(event)}\n\n`);
}

// Conteúdo multimodal (OpenAI-compat): texto + imagens. Quando só texto, content é string.
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[];
  tool_calls?: ToolCallRaw[];
  tool_call_id?: string;
}

export interface ToolCallRaw {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface CompletionResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
      tool_calls?: ToolCallRaw[];
    };
    finish_reason: string;
  }>;
}

export interface StreamChunk {
  choices: Array<{
    delta: { content?: string };
    finish_reason: string | null;
  }>;
}

/** Chama o provedor (Ollama/OpenAI/Anthropic/Google) via formato OpenAI-compat de chat.completions. */
export async function callCompletion(
  msgs: ChatMessage[],
  tools: OllamaTool[],
  model: string,
  signal: AbortSignal,
  stream: false,
  temperature?: number,
  contextWindow?: number,
): Promise<CompletionResponse>;
export async function callCompletion(
  msgs: ChatMessage[],
  tools: OllamaTool[],
  model: string,
  signal: AbortSignal,
  stream: true,
  temperature?: number,
  contextWindow?: number,
): Promise<Response>;
export async function callCompletion(
  msgs: ChatMessage[],
  tools: OllamaTool[],
  model: string,
  signal: AbortSignal,
  streamMode: boolean,
  temperature?: number,
  contextWindow?: number,
): Promise<CompletionResponse | Response> {
  const provider = getProvider(model);
  const { baseUrl, headers } = getProviderConfig(provider);

  const body: Record<string, unknown> = {
    model,
    messages: msgs,
    stream: streamMode,
  };
  if (temperature !== undefined) body.temperature = temperature;
  if (provider === "ollama" && contextWindow && contextWindow > 0) {
    body.options = { num_ctx: contextWindow };
    console.log(`[BIBBLE] num_ctx enviado: ${contextWindow}`);
  }
  if (!streamMode && tools.length > 0) {
    body.tools = tools;
  }

  const res = await fetch(baseUrl, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.status.toString());
    throw new Error(`Provider error ${res.status}: ${text}`);
  }

  if (streamMode) return res;
  return res.json() as Promise<CompletionResponse>;
}
