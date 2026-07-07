export const BIBBLE_OLLAMA_URL =
  process.env.BIBBLE_OLLAMA_URL ?? "http://192.168.35.113:11434";

export const BIBBLE_MODEL =
  process.env.BIBBLE_MODEL ?? "qwen3:14b";

export type Provider = "ollama" | "openai" | "anthropic" | "google";

export interface ModelEntry {
  id: string;
  label: string;
  provider: Provider;
}

export const PROVIDER_MODELS: Record<Provider, ModelEntry[]> = {
  ollama: [
    { id: "qwen3.6:35b",     label: "Qwen 3.6 · 35B",    provider: "ollama" },
    { id: "qwen2.5:14b",     label: "Qwen 2.5 · 14B",    provider: "ollama" },
    { id: "llama3.2",        label: "Llama 3.2",          provider: "ollama" },
    { id: "llama3.1:8b",     label: "Llama 3.1 · 8B",    provider: "ollama" },
    { id: "mistral",         label: "Mistral 7B",         provider: "ollama" },
    { id: "gemma3:12b",      label: "Gemma 3 · 12B",     provider: "ollama" },
    { id: "deepseek-r1:7b",  label: "DeepSeek R1 · 7B",  provider: "ollama" },
    { id: "phi4-mini",       label: "Phi 4 Mini",         provider: "ollama" },
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
  // Ollama: só alguns modelos têm visão (gemma3, llama3.2-vision, llava, qwen-vl, minicpm-v…)
  if (id.includes("gemma3") || id.includes("llava") || id.includes("vision") ||
      id.includes("minicpm") || id.includes("-vl") || id.startsWith("llama3.2")) return true;
  return false;
}

export interface ProviderConfig {
  baseUrl: string;
  headers: Record<string, string>;
}

/**
 * Headers para chamar o Ollama. Inclui `Authorization: Bearer <OLLAMA_API_KEY>` quando
 * a env está setada — necessário em produção, onde o Ollama é exposto via proxy
 * autenticado (Cloudflare). Sem o token o proxy responde 403. Só roda no servidor.
 */
export function getOllamaHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = process.env.OLLAMA_API_KEY;
  return {
    ...extra,
    ...(key ? { Authorization: `Bearer ${key}` } : {}),
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

// ─── Ollama URL Configuration Function ────

/**
 * Fetch available models from Ollama API
 * @param ollamaUrl The Ollama API URL to query
 * @returns Promise resolving to an array of available model IDs
 */
export async function fetchAvailableModels(ollamaUrl: string): Promise<string[]> {
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`, { headers: getOllamaHeaders() });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = (await response.json()) as { models?: Array<{ name: string }> };
    return data.models?.map(model => model.name) ?? [];
  } catch (error) {
    console.error("[BIBBLE] Failed to fetch available models:", error);
    return [];
  }
}

// ─── Update Ollama URL function ────

export async function updateOllamaUrl(newUrl: string): Promise<{ success: boolean; error?: string; availableModels?: string[] }> {
  try {
    // Validate URL format
    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
      return {
        success: false,
        error: 'Invalid URL format. Must start with http:// or https://'
      };
    }

    // Check if the URL is reachable and verify it points to Ollama
    const response = await fetch(`${newUrl}/api/tags`, { headers: getOllamaHeaders() });
    if (!response.ok) {
      return {
        success: false,
        error: `Failed to connect to Ollama at ${newUrl}. HTTP ${response.status}`
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
