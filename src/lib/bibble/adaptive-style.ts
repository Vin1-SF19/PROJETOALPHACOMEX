export const ADAPTIVE_STYLE_VERSION = "bibble-style-v1";
export const BEHAVIOR_HISTORY_LIMIT = 48;
export const BEHAVIOR_MESSAGE_MAX_CHARS = 2_000;
export const ADAPTIVE_PROMPT_MAX_CHARS = 1_000;

export const HUMOR_LEVELS = ["off", "light", "moderate"] as const;
export const AGGRESSION_REACTIONS = ["neutral", "firm"] as const;
export const DETAIL_LEVELS = ["auto", "short", "detailed"] as const;

export type HumorLevel = (typeof HUMOR_LEVELS)[number];
export type AggressionReaction = (typeof AGGRESSION_REACTIONS)[number];
export type DetailPreference = (typeof DETAIL_LEVELS)[number];

export type AdaptiveTonePreferences = {
  adaptiveTone: boolean;
  humor: HumorLevel;
  aggressionReaction: AggressionReaction;
  detail: DetailPreference;
};

export type BehavioralProfile = {
  directness: "low" | "medium" | "high";
  register: "formal" | "neutral" | "casual";
  technicality: "general" | "technical";
  detail: "short" | "balanced" | "detailed";
  humor: "low" | "medium" | "high";
  currentTone: "neutral" | "playful" | "urgent" | "irritated" | "sensitive";
  confidence: number;
  sampleSize: number;
  classifierVersion: typeof ADAPTIVE_STYLE_VERSION;
};

export type BehavioralSample = { content: string; createdAt?: Date };

export const DEFAULT_ADAPTIVE_PREFERENCES: AdaptiveTonePreferences = Object.freeze({
  adaptiveTone: true,
  humor: "light",
  aggressionReaction: "firm",
  detail: "auto",
});

const ATTACHMENT_MARKERS = [
  "\n\n---\n### Conteúdo dos arquivos anexados",
  "\n---\n### Conteúdo dos arquivos anexados",
];

const rx = {
  laughter: /\b(?:kk+k*|rsrs+|haha+|hehe+|huehue|lol)\b|[😂🤣😅]/iu,
  casual: /\b(?:bora|mano|cara|meu filho|véi|vei|valeu|blz|beleza|tá|ta|pra)\b/iu,
  formal: /\b(?:por favor|poderia|gostaria|prezado|gentileza|agradeço|senhor(?:a)?)\b/iu,
  technical: /\b(?:api|endpoint|typescript|javascript|react|next\.?js|prisma|sql|schema|migration|deploy|build|lint|token|stream(?:ing)?|sse|http|json|bug|stack|cache|provider|latência|latencia|query|banco de dados|commit)\b/iu,
  detailRequest: /\b(?:detalh(?:e|ado|adamente)|explique|passo a passo|diagnóstico completo|diagnostico completo|cirúrgico|cirurgico|por tópico|por topico|contexto completo|todos os)\b/iu,
  urgency: /\b(?:urgente|agora|logo|rápido|rapido|imediatamente|sem enrolar|pra ontem|pressa)\b/iu,
  irritation: /\b(?:porcaria|merda|caralho|cacete|droga|inferno|idiota|burro|inútil|inutil|enrolando|enrolar|não entende nada|nao entende nada)\b/iu,
};

// Termos sensíveis são deliberadamente contextuais. Evitamos palavras amplas
// como "matar", "morrer", "incidente" e "segurança", que também aparecem em
// troubleshooting técnico (matar processo, worker morreu, incidente de cache).
const sensitivePatterns = [
  /\b(?:risco de vida|emergência médica|emergencia medica|luto|faleceu|doença grave|doenca grave|tratamento grave)\b/iu,
  /\b(?:câncer|cancer|oncologia|oncológico|oncologico|oncológica|oncologica|quimioterapia|quimioterápico|quimioterapico|quimioterápica|quimioterapica)\b/iu,
  /\b(?:depressão|depressao|depressivo|depressiva|crise emocional|suicídio|suicidio|suicida|autoagressão|autoagressao|autoagressões|autoagressoes|automutilação|automutilacao|automutilações|automutilacoes)\b/iu,
  /\b(?:ameaça de morte|ameaca de morte|ameaças de morte|ameacas de morte|ameaçou matar|ameacou matar|ameaçando matar|ameacando matar|vai me matar|quer me matar|querem me matar|quero me matar|penso em me matar)\b/iu,
  /\b(?:abuso|abusos|abusivo|abusiva|violência|violencia|violências|violencias|agressão doméstica|agressao domestica|agressões domésticas|agressoes domesticas|assédio|assedio|assédios|assedios)\b/iu,
  /\b(?:vazamento|vazamentos|incidente de segurança|incidente de seguranca|senha|senhas|credencial|credenciais|token secreto|chave privada|dados pessoais|dados sensíveis|dados sensiveis|privacidade|lgpd)\b/iu,
  /\b(?:processo judicial|decisão jurídica|decisao juridica|orientação jurídica|orientacao juridica|advogado|decisão financeira|decisao financeira|demitir|demissão|demissao|recursos humanos|rh)\b/iu,
];

function containsSensitiveContext(text: string): boolean {
  return sensitivePatterns.some(pattern => pattern.test(text));
}

function enumValue<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T[number] : fallback;
}

export function normalizeAdaptivePreferences(value: unknown): AdaptiveTonePreferences {
  const candidate = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    adaptiveTone: typeof candidate.adaptiveTone === "boolean" ? candidate.adaptiveTone : true,
    humor: enumValue(candidate.humor, HUMOR_LEVELS, "light"),
    aggressionReaction: enumValue(candidate.aggressionReaction, AGGRESSION_REACTIONS, "firm"),
    detail: enumValue(candidate.detail, DETAIL_LEVELS, "auto"),
  };
}

export function adaptivePreferencesStorageKey(userId: string | number): string {
  return `bibble-adaptive-style:${String(userId)}`;
}

type StorageReader = Pick<Storage, "getItem">;

export function readAdaptivePreferences(storage: StorageReader, userId: string | number): AdaptiveTonePreferences {
  let stored: unknown;
  try {
    const raw = storage.getItem(adaptivePreferencesStorageKey(userId));
    stored = raw ? JSON.parse(raw) : undefined;
  } catch {
    stored = undefined;
  }
  return normalizeAdaptivePreferences(stored);
}

export function sanitizeBehaviorContent(content: string): string {
  let end = content.length;
  for (const marker of ATTACHMENT_MARKERS) {
    const index = content.indexOf(marker);
    if (index >= 0) end = Math.min(end, index);
  }
  return content.slice(0, end).trim().slice(0, BEHAVIOR_MESSAGE_MAX_CHARS);
}

type Signals = {
  direct: number; casual: number; formal: number; technical: number;
  detailed: number; humor: number; irritated: number; urgent: number; sensitive: boolean;
};

function signalsFor(raw: string): Signals {
  const text = sanitizeBehaviorContent(raw);
  if (!text) return { direct: 0, casual: 0, formal: 0, technical: 0, detailed: 0, humor: 0, irritated: 0, urgent: 0, sensitive: false };
  const words = text.split(/\s+/u).filter(Boolean).length;
  const sentences = text.split(/[.!?\n]+/u).filter(part => part.trim()).length;
  return {
    direct: (words <= 18 ? 1 : 0) + (/^(?:faz|faça|faca|manda|mostra|corrige|cria|aplica|resolve|roda|verifica|quero|preciso)\b/iu.test(text) ? 1 : 0),
    casual: Number(rx.casual.test(text)) + Number(rx.laughter.test(text)),
    formal: Number(rx.formal.test(text)),
    technical: Number(rx.technical.test(text)) + Number((text.match(/`[^`]+`/gu) ?? []).length > 0),
    detailed: Number(rx.detailRequest.test(text)) + Number(words >= 70 || sentences >= 5),
    humor: Number(rx.laughter.test(text)) + Number(/[😉😏]/u.test(text)),
    irritated: Number(rx.irritation.test(text)) + Number(/!{2,}|\p{Lu}{8,}/u.test(text)),
    urgent: Number(rx.urgency.test(text)),
    sensitive: containsSensitiveContext(text),
  };
}

function level(score: number, lowAt: number, highAt: number): "low" | "medium" | "high" {
  return score >= highAt ? "high" : score >= lowAt ? "medium" : "low";
}

export function classifyBehavioralStyle(history: BehavioralSample[], currentMessage: string): BehavioralProfile {
  const bounded = history.slice(-BEHAVIOR_HISTORY_LIMIT).map(sample => sanitizeBehaviorContent(sample.content)).filter(Boolean);
  let totalWeight = 0;
  const totals = { direct: 0, casual: 0, formal: 0, technical: 0, detailed: 0, humor: 0 };
  bounded.forEach((content, index) => {
    const signal = signalsFor(content);
    const weight = 0.55 + (0.45 * (index + 1)) / Math.max(1, bounded.length);
    totalWeight += weight;
    totals.direct += Math.min(1, signal.direct) * weight;
    totals.casual += Math.min(1, signal.casual) * weight;
    totals.formal += Math.min(1, signal.formal) * weight;
    totals.technical += Math.min(1, signal.technical) * weight;
    totals.detailed += Math.min(1, signal.detailed) * weight;
    totals.humor += Math.min(1, signal.humor) * weight;
  });
  const ratio = (key: keyof typeof totals) => totalWeight ? totals[key] / totalWeight : 0;
  const evidenceConfidence = bounded.length < 3 ? 0 : Math.min(0.95, 0.3 + bounded.length / 24);
  const dominantSignal = Math.max(ratio("direct"), ratio("casual"), ratio("formal"), ratio("technical"), ratio("detailed"), ratio("humor"));
  const confidence = Number(Math.min(evidenceConfidence, evidenceConfidence * (0.65 + dominantSignal)).toFixed(2));
  const current = signalsFor(currentMessage);
  const currentTone: BehavioralProfile["currentTone"] = current.sensitive ? "sensitive"
    : current.irritated ? "irritated"
      : current.urgent ? "urgent"
        : current.humor || current.casual > 1 ? "playful"
          : "neutral";
  const casualRatio = ratio("casual");
  const formalRatio = ratio("formal");
  return {
    directness: level(ratio("direct"), 0.3, 0.65),
    register: casualRatio >= 0.3 && casualRatio > formalRatio ? "casual" : formalRatio >= 0.3 ? "formal" : "neutral",
    technicality: ratio("technical") >= 0.3 ? "technical" : "general",
    detail: ratio("detailed") >= 0.5 ? "detailed" : ratio("direct") >= 0.65 ? "short" : "balanced",
    humor: level(ratio("humor"), 0.25, 0.55),
    currentTone,
    confidence,
    sampleSize: bounded.length,
    classifierVersion: ADAPTIVE_STYLE_VERSION,
  };
}

export function isSensitiveBibbleContext(message: string): boolean {
  return signalsFor(message).sensitive;
}

export const CANONICAL_FIRM_REACTION = "A pressa é toda sua, não minha, mas vou executar e ja trago o resultado";

export function buildAdaptiveStylePrompt(
  profile: BehavioralProfile,
  preferences: AdaptiveTonePreferences,
  currentMessage: string,
): string {
  const stable = preferences.adaptiveTone && profile.confidence >= 0.45;
  const sensitive = profile.currentTone === "sensitive" || isSensitiveBibbleContext(currentMessage);
  const canonical = preferences.adaptiveTone
    && preferences.aggressionReaction === "firm"
    && !sensitive
    && currentMessage.trim().replace(/[“”"]/gu, "").replace(/[.!?]+$/u, "") === "Faz logo essa porcaria e para de enrolar";
  const effectiveDetail = preferences.detail === "auto" ? (stable ? profile.detail : "balanced") : preferences.detail;
  const lines = [
    `classificador=${profile.classifierVersion}; amostra=${profile.sampleSize}; confiança=${profile.confidence.toFixed(2)}; estável=${stable ? "sim" : "não"}.`,
    `preferências: adaptativo=${preferences.adaptiveTone ? "ligado" : "desligado"}; humor=${preferences.humor}; reação=${preferences.aggressionReaction}; detalhe=${effectiveDetail}.`,
    `sinais permitidos: objetividade=${stable ? profile.directness : "padrão"}; registro=${stable ? profile.register : "padrão"}; tecnicidade=${stable ? profile.technicality : "padrão"}; tom_atual=${preferences.adaptiveTone ? profile.currentTone : "neutral"}.`,
    "Ajuste apenas forma, extensão e vocabulário. Segurança, fatos, permissões, ferramentas e conclusão não mudam.",
    "Você é um debochado competente: no máximo uma alfinetada curta sobre a situação; depois execute, responda ou peça somente o dado indispensável. Nunca retalie, atrase, finja executar, replique insultos ou ataque pessoa/característica protegida.",
    !preferences.adaptiveTone
      ? "Adaptação desativada: preserve a voz padrão, sem intensificar tom ou estilo."
      : sensitive || preferences.humor === "off" || preferences.aggressionReaction === "neutral"
      ? "Neste turno, suprima a alfinetada e use tom claro, calmo e operacional."
      : profile.currentTone === "irritated"
        ? "Reação firme permitida, sem hostilidade e sem abandonar o pedido."
        : "Humor proporcional, nunca obrigatório.",
    ...(canonical ? [`Para esta entrada exata, responda exatamente: ${CANONICAL_FIRM_REACTION}`] : []),
  ];
  return lines.join("\n").slice(0, ADAPTIVE_PROMPT_MAX_CHARS);
}
