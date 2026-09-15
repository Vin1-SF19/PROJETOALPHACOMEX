export const BIBBLE_OLLAMA_URL =
  process.env.BIBBLE_OLLAMA_URL ?? "http://127.0.0.1:18080";

export const BIBBLE_MODEL =
  process.env.BIBBLE_MODEL ?? "qwen3.8-131k";

export type Provider = "ollama" | "openai" | "anthropic" | "google";

export interface ModelEntry {
  id: string;
  label: string;
  provider: Provider;
}

export const PROVIDER_MODELS: Record<Provider, ModelEntry[]> = {
  // Servidor local trocou de Ollama para llama.cpp (llama-qwen.service) em
  // 2026-09-14 — serve um único modelo carregado via --model/--alias, sem
  // troca dinâmica de modelo em runtime. Lista de tags do Ollama removida.
  ollama: [
    { id: "qwen3.8-131k", label: "Qwen 3.8 · 131K (llama.cpp)", provider: "ollama" },
  ],
  openai: [
    { id: "gpt-4o",       label: "GPT-4o",       provider: "openai" },
    { id: "gpt-4o-mini",  label: "GPT-4o Mini",  provider: "openai" },
    { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", provider: "openai" },
  ],
  anthropic: [
    { id: "claude-opus-4-8",   label: "Claude Opus 4.8",   provider: "anthropic" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic" },
    { id: "claude-haiku-4-5",  label: "Claude Haiku 4.5",  provider: "anthropic" },
  ],
  google: [
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "google" },
    { id: "gemini-1.5-pro",   label: "Gemini 1.5 Pro",   provider: "google" },
    { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash", provider: "google" },
  ],
};

export const ALL_MODELS: ModelEntry[] = Object.values(PROVIDER_MODELS).flat();

export function getProvider(modelId: string): Provider {
  const found = ALL_MODELS.find(m => m.id === modelId);
  if (found) return found.provider;
  if (modelId.startsWith("gpt-") || modelId.startsWith("o1") || modelId.startsWith("o3")) return "openai";
  if (modelId.startsWith("claude-")) return "anthropic";
  if (modelId.startsWith("gemini-")) return "google";
  return "ollama";
}

export function getModelLabel(modelId: string): string {
  return ALL_MODELS.find(m => m.id === modelId)?.label ?? modelId;
}

/**
 * True se o modelo aceita imagens (visão). Usado para avisar o usuário antes
 * de mandar uma imagem que o modelo não conseguiria analisar.
 */
export function modelSupportsVision(modelId: string): boolean {
  const id = modelId.toLowerCase();
  // OpenAI: família 4o e 4.1 têm visão
  if (id.startsWith("gpt-4o") || id.startsWith("gpt-4.1") || id.startsWith("o1") || id.startsWith("o3")) return true;
  // Claude 3.x/4.x são multimodais
  if (id.startsWith("claude-")) return true;
  // Gemini é multimodal
  if (id.startsWith("gemini-")) return true;
  // Ollama: só alguns modelos têm visão (qwen3.8/3.6/3.5, gemma3, llava, qwen-vl, minicpm-v…)
  if (id.startsWith("qwen3.8") || id.startsWith("qwen3.6") || id.startsWith("qwen3.5") ||
      id.includes("gemma3") || id.includes("llava") || id.includes("vision") ||
      id.includes("minicpm") || id.includes("-vl") || id.startsWith("llama3.2")) return true;
  return false;
}

export interface ProviderConfig {
  baseUrl: string;
  headers: Record<string, string>;
}

/**
 * Headers para chamar o servidor local (llama.cpp, ex-Ollama). Inclui
 * `Authorization: Bearer <OLLAMA_API_KEY>` quando a env está setada —
 * necessário caso o endpoint volte a ser exposto via proxy autenticado
 * (Cloudflare). Sem o token o proxy responde 403. Só roda no servidor.
 */
export function getOllamaHeaders(
  extra: Record<string, string> = {},
  apiKey: string | undefined = process.env.OLLAMA_API_KEY,
): Record<string, string> {
  return {
    ...extra,
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };
}

export function getProviderConfig(provider: Provider): ProviderConfig {
  switch (provider) {
    case "ollama":
      return {
        baseUrl: `${BIBBLE_OLLAMA_URL}/v1/chat/completions`,
        headers: getOllamaHeaders({ "Content-Type": "application/json" }),
      };
    case "openai":
      return {
        baseUrl: "https://api.openai.com/v1/chat/completions",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
        },
      };
    case "anthropic":
      return {
        baseUrl: "https://api.anthropic.com/v1/chat/completions",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "tools-2024-04-04",
        },
      };
    case "google":
      return {
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GOOGLE_AI_API_KEY ?? ""}`,
        },
      };
  }
}

// ─── Local server URL configuration ────

/**
 * Busca os modelos disponíveis no servidor local via endpoint OpenAI-compat
 * `/v1/models` — o llama.cpp não implementa o `/api/tags` do Ollama.
 * @param ollamaUrl URL base do servidor (llama.cpp)
 * @returns Promise resolvendo para um array de IDs de modelo disponíveis
 */
export async function fetchAvailableModels(ollamaUrl: string): Promise<string[]> {
  try {
    const response = await fetch(`${ollamaUrl}/v1/models`, { headers: getOllamaHeaders() });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = (await response.json()) as { data?: Array<{ id: string }> };
    return data.data?.map(model => model.id) ?? [];
  } catch (error) {
    console.error("[BIBBLE] Failed to fetch available models:", error);
    return [];
  }
}

// ─── Update local server URL function ────

export async function updateOllamaUrl(newUrl: string): Promise<{ success: boolean; error?: string; availableModels?: string[] }> {
  try {
    // Validate URL format
    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
      return {
        success: false,
        error: 'Invalid URL format. Must start with http:// or https://'
      };
    }

    // Verifica se a URL responde ao endpoint OpenAI-compat de listagem de modelos
    const response = await fetch(`${newUrl}/v1/models`, { headers: getOllamaHeaders() });
    if (!response.ok) {
      return {
        success: false,
        error: `Failed to connect to local model server at ${newUrl}. HTTP ${response.status}`
      };
    }

    // Update process.env.BIBBLE_OLLAMA_URL (this will be used in client-side)
    process.env.BIBBLE_OLLAMA_URL = newUrl;

    // Try to get available models
    const availableModels = await fetchAvailableModels(newUrl);

    return {
      success: true,
      availableModels: availableModels
    };
  } catch (error) {
    console.error("[BIBBLE] Error updating Ollama URL:", error);
    return {
      success: false,
      error: `Failed to update Ollama URL: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
