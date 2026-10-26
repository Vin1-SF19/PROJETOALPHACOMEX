import { comPrazoHttp } from "@/lib/http-deadline";
import { ConsultaPainelIndisponivel, esperaRetryAfter } from "@/lib/painel-polling";

const messages: Record<string, string> = {
  AUTH_UNAVAILABLE: "A conexão com o painel precisa ser validada.",
  AI_METADATA_UNAVAILABLE: "Os dados dos agentes estão temporariamente indisponíveis.",
  AI_CONFIGURATION_UNAVAILABLE: "A integração de IA não está configurada neste ambiente ou usuário.",
  VOICE_MISCONFIGURED: "A voz não está configurada neste ambiente.",
  AI_UPSTREAM_UNAVAILABLE: "O serviço de IA está temporariamente indisponível.",
  AI_UPSTREAM_TIMEOUT: "O serviço de IA excedeu o tempo de resposta.",
  AI_RATE_LIMITED: "O serviço de IA está ocupado. Aguarde para tentar novamente.",
};
export function mensagemIndisponibilidadeIA(error: unknown): string {
  return error instanceof ConsultaPainelIndisponivel ? messages[error.code] ?? "Integração temporariamente indisponível." : "Integração temporariamente indisponível.";
}
export function codigoPublicoIA(body: unknown): string {
  if (body && typeof body === "object" && "code" in body && typeof body.code === "string" && body.code in messages) return body.code;
  return "AI_UPSTREAM_UNAVAILABLE";
}
export async function consultarIntegracaoIA<T>(url: string, signal?: AbortSignal): Promise<T> {
  return comPrazoHttp(30_000, signal, async (bounded) => {
    const response = await fetch(url, { signal: bounded, cache: "no-store", credentials: "same-origin" });
    const body: unknown = await response.json();
    if (!response.ok) throw new ConsultaPainelIndisponivel(esperaRetryAfter(response.headers.get("Retry-After")), codigoPublicoIA(body));
    return body as T;
  });
}

/** GET recovery only; never use this delay to replay a chat or voice POST. */
export function esperaRecuperacaoIA(error: unknown, failures = 1): number {
  return Math.max(error instanceof ConsultaPainelIndisponivel ? error.retryAfterMs : 0,
    Math.min(300_000, 60_000 * 2 ** Math.min(3, Math.max(0, failures - 1))));
}
