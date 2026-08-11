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

export interface CompletionStreamResult {
  finishReason: string | null;
  chunks: number;
}

export function isOutputTruncated(finishReason: string | null | undefined): boolean {
  return finishReason === "length" || finishReason === "max_tokens";
}

/** Consome todos os frames SSE do provider, inclusive o frame final sem newline. */
export async function consumeCompletionStream(
  response: Response,
  onText: (text: string) => void,
): Promise<CompletionStreamResult> {
  if (!response.body) throw new Error("Stream sem body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finishReason: string | null = null;
  let chunks = 0;

  const processLine = (line: string) => {
    if (!line.startsWith("data: ")) return;
    const raw = line.slice(6).trim();
    if (!raw || raw === "[DONE]") return;
    try {
      const chunk = JSON.parse(raw) as StreamChunk;
      const choice = chunk.choices[0];
      if (choice?.finish_reason) finishReason = choice.finish_reason;
      const delta = choice?.delta?.content;
      if (delta) {
        chunks += 1;
        onText(delta);
      }
    } catch { /* ignora apenas frames malformados */ }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) processLine(line);
  }

  buffer += decoder.decode();
  for (const line of buffer.split("\n")) processLine(line);

  return { finishReason, chunks };
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
  maxOutputTokens?: number,
): Promise<CompletionResponse>;
export async function callCompletion(
  msgs: ChatMessage[],
  tools: OllamaTool[],
  model: string,
  signal: AbortSignal,
  stream: true,
  temperature?: number,
  contextWindow?: number,
  maxOutputTokens?: number,
): Promise<Response>;
export async function callCompletion(
  msgs: ChatMessage[],
  tools: OllamaTool[],
  model: string,
  signal: AbortSignal,
  streamMode: boolean,
  temperature?: number,
  contextWindow?: number,
  maxOutputTokens?: number,
): Promise<CompletionResponse | Response> {
  const provider = getProvider(model);
  const { baseUrl, headers } = getProviderConfig(provider);

  const body: Record<string, unknown> = {
    model,
    messages: msgs,
    stream: streamMode,
  };
  if (temperature !== undefined) body.temperature = temperature;
  if (maxOutputTokens && maxOutputTokens > 0) {
    if (provider === "openai" && /^(o1|o3)/i.test(model)) {
      body.max_completion_tokens = maxOutputTokens;
    } else {
      body.max_tokens = maxOutputTokens;
    }
  }
  if (provider === "ollama" && (contextWindow || maxOutputTokens)) {
    body.options = {
      ...(contextWindow && contextWindow > 0 ? { num_ctx: contextWindow } : {}),
      ...(maxOutputTokens && maxOutputTokens > 0 ? { num_predict: maxOutputTokens } : {}),
    };
  }
  if (!streamMode && tools.length > 0) {
    body.tools = tools;
  }

  console.info("[BIBBLE COMPLETION] request", {
    stage: streamMode ? "final-stream" : "tool-decision",
    provider,
    contextWindow: contextWindow ?? null,
    outputTokenLimit: maxOutputTokens ?? null,
    toolCount: !streamMode ? tools.length : 0,
  });

  const res = await fetch(baseUrl, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    throw new Error(`Provider error ${res.status}`);
  }

  if (streamMode) return res;
  return res.json() as Promise<CompletionResponse>;
}
