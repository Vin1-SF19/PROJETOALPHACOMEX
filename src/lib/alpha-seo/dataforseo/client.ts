import "server-only";

import { dataForSeoEnvelopeSchema, type DataForSeoTask } from "./schemas";

const API_BASE = "https://api.dataforseo.com/v3";
const DEFAULT_TIMEOUT_MS = 60_000;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export class DataForSeoError extends Error {
  constructor(
    public readonly code: "CONFIG" | "AUTH" | "RATE_LIMIT" | "UPSTREAM" | "INVALID_RESPONSE" | "TASK_FAILED",
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "DataForSeoError";
  }
}

export interface DataForSeoCallResult {
  task: DataForSeoTask;
  result: unknown[];
  costUsd: number;
}

function authorizationHeader(): string {
  const direct = process.env.DATAFORSEO_API_KEY?.trim();
  if (direct) return direct.startsWith("Basic ") ? direct : `Basic ${direct}`;
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) {
    throw new DataForSeoError("CONFIG", "Configure DATAFORSEO_API_KEY ou DATAFORSEO_LOGIN/DATAFORSEO_PASSWORD", false);
  }
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

function providerMessage(status: number, taskMessage?: string): string {
  if (status === 401 || status === 403) return "Credenciais DataForSEO inválidas ou sem acesso";
  if (status === 429) return "Limite temporário da DataForSEO atingido; tente novamente";
  if (status >= 500) return "DataForSEO está temporariamente indisponível";
  return taskMessage?.slice(0, 300) || "A DataForSEO rejeitou a solicitação";
}

export interface DataForSeoClientOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxAttempts?: number;
}

export function createAlphaSeoDataForSeoClient(options: DataForSeoClientOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? 3, 3));

  async function live(path: string, payload: Record<string, unknown>): Promise<DataForSeoCallResult> {
    const endpoint = `${API_BASE}/${path.replace(/^\/+/, "")}`;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: { Authorization: authorizationHeader(), "Content-Type": "application/json" },
          body: JSON.stringify([payload]),
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        });
        if (!response.ok) {
          if (RETRYABLE_STATUS.has(response.status) && attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
            continue;
          }
          const code = response.status === 401 || response.status === 403 ? "AUTH" : response.status === 429 ? "RATE_LIMIT" : "UPSTREAM";
          throw new DataForSeoError(code, providerMessage(response.status), RETRYABLE_STATUS.has(response.status));
        }

        const envelope = dataForSeoEnvelopeSchema.safeParse(await response.json());
        if (!envelope.success || envelope.data.status_code !== 20000) {
          throw new DataForSeoError("INVALID_RESPONSE", "Resposta inválida da DataForSEO", false);
        }
        const task = envelope.data.tasks?.[0];
        if (!task) throw new DataForSeoError("INVALID_RESPONSE", "Resposta DataForSEO sem tarefa", false);
        const noResults = task.status_message?.toLowerCase().includes("no search results") ?? false;
        if (task.status_code !== 20000 && !noResults) {
          throw new DataForSeoError("TASK_FAILED", providerMessage(task.status_code, task.status_message), false);
        }
        return { task, result: task.result ?? [], costUsd: task.cost ?? 0 };
      } catch (error) {
        lastError = error;
        if (error instanceof DataForSeoError && !error.retryable) throw error;
        if (attempt >= maxAttempts) break;
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
    if (lastError instanceof DataForSeoError) throw lastError;
    throw new DataForSeoError("UPSTREAM", "Falha de rede ao consultar DataForSEO", true);
  }

  return { live };
}
