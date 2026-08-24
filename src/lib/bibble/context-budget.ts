import { getProvider, type Provider } from "./client";
import type { ChatMessage } from "./completion";

export const CHARS_PER_TOKEN = 4;
export const DEFAULT_CONTEXT_WINDOW_TOKENS = 32_768;
export const LEGACY_CONTEXT_WINDOW_TOKENS = 4_096;
export const DEFAULT_OUTPUT_TOKEN_LIMIT = 4_096;
export const MIN_OUTPUT_TOKEN_LIMIT = 1_024;

// Servidor Ollama (192.168.35.113) roda em GPU com VRAM alta — a janela de
// contexto e o teto de saída padrão do Ollama podiam ser aumentados com
// segurança. Anexo (PDF/documento) é o caso que mais precisa de margem: várias
// páginas de extrato + resposta longa estruturada (lançamentos, tabelas) não
// cabiam nos 32k/4k anteriores. Configurável via env para ajuste sem deploy
// caso o hardware do servidor mude.
export const ATTACHMENT_CONTEXT_WINDOW_TOKENS =
  Number(process.env.BIBBLE_ATTACHMENT_CONTEXT_WINDOW) || 131_072;
export const ATTACHMENT_OUTPUT_TOKEN_LIMIT =
  Number(process.env.BIBBLE_ATTACHMENT_OUTPUT_TOKENS) || 16_384;

const MAX_CONFIGURABLE_CONTEXT_WINDOW = 262_144;
const MIN_PDF_CONTEXT_WINDOW = ATTACHMENT_CONTEXT_WINDOW_TOKENS;
const MESSAGE_OVERHEAD_TOKENS = 8;

const PROVIDER_CONTEXT_WINDOWS: Record<Provider, number> = {
  ollama: DEFAULT_CONTEXT_WINDOW_TOKENS,
  openai: 128_000,
  anthropic: 200_000,
  google: 1_048_576,
};

// Teto de saída "normal" (sem anexo) por provider — mantido conservador para
// não pagar latência desnecessária em conversas curtas.
const PROVIDER_OUTPUT_LIMITS: Record<Provider, number> = {
  ollama: DEFAULT_OUTPUT_TOKEN_LIMIT,
  openai: 16_384,
  anthropic: 8_192,
  google: 8_192,
};

// Teto de saída quando HÁ anexo — resposta pode ser longa (relatório,
// lançamentos contábeis, tabelas). Ollama sobe para o valor configurável
// acima; providers remotos sobem para o próprio limite real deles (não mais
// capados artificialmente pelo DEFAULT_OUTPUT_TOKEN_LIMIT genérico).
const PROVIDER_ATTACHMENT_OUTPUT_LIMITS: Record<Provider, number> = {
  ollama: ATTACHMENT_OUTPUT_TOKEN_LIMIT,
  openai: 32_768,
  anthropic: 8_192,
  google: 65_536,
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
  // Com anexo, o piso passa a ser a janela dedicada a documentos — bem maior
  // que o default de conversa — para não cortar o próprio conteúdo do PDF.
  const baselineForRequest = input.hasPdf
    ? Math.max(providerDefault, ATTACHMENT_CONTEXT_WINDOW_TOKENS)
    : providerDefault;
  const requested = Number.isFinite(input.requestedContextWindow)
    ? Math.floor(input.requestedContextWindow as number)
    : undefined;
  const legacyOrInsufficientForPdf = input.hasPdf
    && (requested === undefined || requested <= LEGACY_CONTEXT_WINDOW_TOKENS || requested < MIN_PDF_CONTEXT_WINDOW);

  let effective = requested && requested > 0 ? requested : baselineForRequest;
  if (legacyOrInsufficientForPdf) effective = baselineForRequest;

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
  const providerOutputLimit = input.hasPdf
    ? PROVIDER_ATTACHMENT_OUTPUT_LIMITS[resolved.provider]
    : PROVIDER_OUTPUT_LIMITS[resolved.provider];
  const outputCeiling = input.hasPdf ? providerOutputLimit : DEFAULT_OUTPUT_TOKEN_LIMIT;
  const outputTokenLimit = Math.max(
    MIN_OUTPUT_TOKEN_LIMIT,
    Math.min(
      outputCeiling,
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

/**
 * Divide o orçamento de conteúdo entre N arquivos anexados, cada um com uma
 * fatia GARANTIDA, em vez de consumo sequencial (onde o 1º arquivo processado
 * podia esgotar o orçamento e cortar o conteúdo dos seguintes por completo).
 * Arquivos maiores recebem fatia proporcionalmente maior, mas nenhum fica
 * com menos que `minTokensPerFile` enquanto o total permitir.
 */
export function allocatePerFileBudget(
  fileSizesChars: number[],
  totalTokenBudget: number,
  minTokensPerFile = 512,
): number[] {
  const n = fileSizesChars.length;
  if (n === 0) return [];
  const totalBudget = Math.max(0, Math.floor(totalTokenBudget));

  const guaranteedTotal = minTokensPerFile * n;
  if (totalBudget <= guaranteedTotal) {
    // Não há espaço nem para o piso de todos — distribui igualmente.
    const equal = Math.floor(totalBudget / n);
    return new Array(n).fill(equal);
  }

  const totalChars = fileSizesChars.reduce((sum, c) => sum + Math.max(0, c), 0);
  const remaining = totalBudget - guaranteedTotal;
  if (totalChars === 0) {
    const equal = Math.floor(totalBudget / n);
    return new Array(n).fill(equal);
  }

  return fileSizesChars.map(chars => {
    const proportional = Math.floor((Math.max(0, chars) / totalChars) * remaining);
    return minTokensPerFile + proportional;
  });
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
