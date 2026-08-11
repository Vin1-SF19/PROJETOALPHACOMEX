import { getProvider, type Provider } from "./client";
import type { ChatMessage } from "./completion";

export const CHARS_PER_TOKEN = 4;
export const DEFAULT_CONTEXT_WINDOW_TOKENS = 32_768;
export const LEGACY_CONTEXT_WINDOW_TOKENS = 4_096;
export const DEFAULT_OUTPUT_TOKEN_LIMIT = 4_096;
export const MIN_OUTPUT_TOKEN_LIMIT = 1_024;

const MAX_CONFIGURABLE_CONTEXT_WINDOW = 262_144;
const MIN_PDF_CONTEXT_WINDOW = DEFAULT_CONTEXT_WINDOW_TOKENS;
const MESSAGE_OVERHEAD_TOKENS = 8;

const PROVIDER_CONTEXT_WINDOWS: Record<Provider, number> = {
  ollama: DEFAULT_CONTEXT_WINDOW_TOKENS,
  openai: 128_000,
  anthropic: 200_000,
  google: 1_048_576,
};

const PROVIDER_OUTPUT_LIMITS: Record<Provider, number> = {
  ollama: DEFAULT_OUTPUT_TOKEN_LIMIT,
  openai: 16_384,
  anthropic: 8_192,
  google: 8_192,
};

export type TextSelectionStrategy = "full" | "head-middle-tail" | "capacity-notice";

export interface TextSelection {
  text: string;
  strategy: TextSelectionStrategy;
  originalChars: number;
  includedChars: number;
  estimatedTokens: number;
  reduced: boolean;
}

export interface RequestBudget {
  provider: Provider;
  requestedContextWindow?: number;
  effectiveContextWindow: number;
  inputTokenBudget: number;
  outputTokenLimit: number;
  fixedInputTokens: number;
  availableContentTokens: number;
  legacyContextAdjusted: boolean;
  fitsFixedInput: boolean;
}

export function estimateTokens(value: unknown): number {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return Math.max(0, Math.ceil(text.length / CHARS_PER_TOKEN));
}

export function resolveEffectiveContextWindow(input: {
  model: string;
  requestedContextWindow?: number;
  hasPdf: boolean;
}): { provider: Provider; effectiveContextWindow: number; legacyContextAdjusted: boolean } {
  const provider = getProvider(input.model);
  const providerDefault = PROVIDER_CONTEXT_WINDOWS[provider];
  const requested = Number.isFinite(input.requestedContextWindow)
    ? Math.floor(input.requestedContextWindow as number)
    : undefined;
  const legacyOrInsufficientForPdf = input.hasPdf
    && (requested === undefined || requested <= LEGACY_CONTEXT_WINDOW_TOKENS || requested < MIN_PDF_CONTEXT_WINDOW);

  let effective = requested && requested > 0 ? requested : providerDefault;
  if (legacyOrInsufficientForPdf) effective = providerDefault;

  // Ollama pode ser configurado acima do default; providers remotos são
  // limitados à capacidade conhecida do endpoint OpenAI-compat utilizado.
  const maximum = provider === "ollama"
    ? MAX_CONFIGURABLE_CONTEXT_WINDOW
    : providerDefault;
  effective = Math.min(Math.max(effective, MIN_OUTPUT_TOKEN_LIMIT * 2), maximum);

  return {
    provider,
    effectiveContextWindow: effective,
    legacyContextAdjusted: legacyOrInsufficientForPdf,
  };
}

export function calculateRequestBudget(input: {
  model: string;
  requestedContextWindow?: number;
  hasPdf: boolean;
  systemPrompt: string;
  userPrompt: string;
  tools?: unknown[];
  imageCount?: number;
}): RequestBudget {
  const resolved = resolveEffectiveContextWindow(input);
  const providerOutputLimit = PROVIDER_OUTPUT_LIMITS[resolved.provider];
  const outputTokenLimit = Math.max(
    MIN_OUTPUT_TOKEN_LIMIT,
    Math.min(
      DEFAULT_OUTPUT_TOKEN_LIMIT,
      providerOutputLimit,
      Math.floor(resolved.effectiveContextWindow / 4),
    ),
  );
  const inputTokenBudget = resolved.effectiveContextWindow - outputTokenLimit;
  const fixedInputTokens =
    estimateTokens(input.systemPrompt)
    + estimateTokens(input.userPrompt)
    + estimateTokens(input.tools ?? [])
    + (input.imageCount ?? 0) * 1_024
    + MESSAGE_OVERHEAD_TOKENS * 2;

  return {
    provider: resolved.provider,
    requestedContextWindow: input.requestedContextWindow,
    effectiveContextWindow: resolved.effectiveContextWindow,
    inputTokenBudget,
    outputTokenLimit,
    fixedInputTokens,
    availableContentTokens: Math.max(0, inputTokenBudget - fixedInputTokens),
    legacyContextAdjusted: resolved.legacyContextAdjusted,
    fitsFixedInput: fixedInputTokens <= inputTokenBudget,
  };
}

/**
 * Reduz texto grande sem privilegiar apenas o início e deixa a redução
 * explícita dentro do próprio contexto enviado ao modelo.
 */
export function selectTextForTokenBudget(
  text: string,
  tokenBudget: number,
  label = "documento",
): TextSelection {
  const normalizedBudget = Math.max(0, Math.floor(tokenBudget));
  const maxChars = normalizedBudget * CHARS_PER_TOKEN;
  const originalChars = text.length;

  if (originalChars <= maxChars) {
    return {
      text,
      strategy: "full",
      originalChars,
      includedChars: originalChars,
      estimatedTokens: estimateTokens(text),
      reduced: false,
    };
  }

  const notice = `\n\n[CAPACIDADE: ${label} reduzido de ${originalChars} caracteres; foram preservados trechos do início, meio e fim. A análise não representa leitura integral.]\n\n`;
  const availableDocumentChars = Math.max(0, maxChars - notice.length * 2);

  if (availableDocumentChars < 3) {
    const capacityNotice = `[CAPACIDADE: sem espaço suficiente para incluir ${label}.]`.slice(0, maxChars);
    return {
      text: capacityNotice,
      strategy: "capacity-notice",
      originalChars,
      includedChars: 0,
      estimatedTokens: estimateTokens(capacityNotice),
      reduced: true,
    };
  }

  const headLength = Math.ceil(availableDocumentChars / 3);
  const middleLength = Math.floor(availableDocumentChars / 3);
  const tailLength = availableDocumentChars - headLength - middleLength;
  const middleStart = Math.max(0, Math.floor((originalChars - middleLength) / 2));
  const selected = [
    text.slice(0, headLength),
    notice,
    text.slice(middleStart, middleStart + middleLength),
    notice,
    tailLength > 0 ? text.slice(originalChars - tailLength) : "",
  ].join("");
  // Duas marcações tornam as lacunas inequívocas; ajuste o payload final
  // ao teto mesmo quando a mensagem de transparência ocupa parte relevante.
  const bounded = selected.length > maxChars ? selected.slice(0, maxChars) : selected;

  return {
    text: bounded,
    strategy: "head-middle-tail",
    originalChars,
    includedChars: headLength + middleLength + tailLength,
    estimatedTokens: estimateTokens(bounded),
    reduced: true,
  };
}

export function selectRecentHistory(
  history: ChatMessage[],
  tokenBudget: number,
): { messages: ChatMessage[]; estimatedTokens: number; reduced: boolean } {
  const selected: ChatMessage[] = [];
  let remaining = Math.max(0, Math.floor(tokenBudget));
  let reduced = false;

  for (let index = history.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const message = history[index];
    const content = typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content);
    const fullCost = estimateTokens(content) + MESSAGE_OVERHEAD_TOKENS;

    if (fullCost <= remaining) {
      selected.unshift(message);
      remaining -= fullCost;
      continue;
    }

    const contentBudget = Math.max(0, remaining - MESSAGE_OVERHEAD_TOKENS);
    const fitted = selectTextForTokenBudget(content, contentBudget, "mensagem histórica");
    if (fitted.text) {
      selected.unshift({ ...message, content: fitted.text });
      remaining = Math.max(0, remaining - fitted.estimatedTokens - MESSAGE_OVERHEAD_TOKENS);
    }
    reduced = true;
    break;
  }

  return {
    messages: selected,
    estimatedTokens: Math.max(0, Math.floor(tokenBudget) - remaining),
    reduced: reduced || selected.length < history.length,
  };
}
