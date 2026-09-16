import db from "@/lib/prisma";
import {
  BEHAVIOR_HISTORY_LIMIT,
  classifyBehavioralStyle,
  sanitizeBehaviorContent,
  type BehavioralProfile,
  type BehavioralSample,
} from "@/lib/bibble/adaptive-style";

type BehavioralMessageStore = {
  findMany(args: {
    where: { role: "user"; session: { userId: number; onyxSessionId: null } };
    orderBy: Array<{ createdAt: "desc" } | { id: "desc" }>;
    take: number;
    select: { content: true; createdAt: true };
  }): Promise<Array<{ content: string; createdAt: Date }>>;
};

type BehavioralUserStore = {
  findMany(args: {
    where: { nome: { contains: string } };
    orderBy: Array<{ nome: "asc" } | { id: "asc" }>;
    take: number;
    select: { id: true; nome: true };
  }): Promise<Array<{ id: number; nome: string }>>;
};

export const BEHAVIORAL_PROFILE_MIN_SAMPLE = 3;
export const BEHAVIORAL_PROFILE_MIN_CONFIDENCE = 0.45;
const BEHAVIORAL_TARGET_MATCH_LIMIT = 6;
const BEHAVIORAL_TARGET_NAME_MAX_CHARS = 100;

type BehavioralDimension<T extends string> = {
  code: T;
  label: string;
};

export type BehavioralAggregate = {
  objetividade: BehavioralDimension<BehavioralProfile["directness"]>;
  registro: BehavioralDimension<BehavioralProfile["register"]>;
  tecnicidade: BehavioralDimension<BehavioralProfile["technicality"]>;
  nivelDeDetalhe: BehavioralDimension<BehavioralProfile["detail"]>;
  humor: BehavioralDimension<BehavioralProfile["humor"]>;
};

export type BehavioralProfileInspection =
  | { status: "invalid_query"; message: string }
  | { status: "not_found"; query: string; message: string }
  | { status: "ambiguous"; query: string; candidates: string[]; truncated: boolean; message: string }
  | {
      status: "insufficient_sample" | "ready";
      target: { name: string };
      sampleSize: number;
      period: { first: string; last: string } | null;
      confidence: number;
      confidenceLabel: "insuficiente" | "baixa" | "média" | "alta";
      classifierVersion: BehavioralProfile["classifierVersion"];
      insufficientSample: boolean;
      aggregate: BehavioralAggregate | null;
      facts: string[];
      summary: string;
    };

function normalizePersonName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function confidenceLabel(profile: BehavioralProfile): "insuficiente" | "baixa" | "média" | "alta" {
  if (
    profile.sampleSize < BEHAVIORAL_PROFILE_MIN_SAMPLE
    || profile.confidence < BEHAVIORAL_PROFILE_MIN_CONFIDENCE
  ) return "insuficiente";
  if (profile.confidence >= 0.75) return "alta";
  if (profile.confidence >= 0.5) return "média";
  return "baixa";
}

function aggregateBehavioralProfile(profile: BehavioralProfile): { aggregate: BehavioralAggregate; facts: string[] } {
  const facts = {
    directness: {
      low: "costuma contextualizar antes de pedir",
      medium: "equilibra contexto e objetividade",
      high: "costuma ser direta e objetiva",
    },
    register: {
      formal: "usa um registro mais formal",
      neutral: "usa um registro neutro",
      casual: "usa um registro casual e descontraído",
    },
    technicality: {
      technical: "emprega vocabulário técnico com frequência",
      general: "prefere linguagem geral, sem excesso de termos técnicos",
    },
    detail: {
      short: "prefere respostas curtas",
      balanced: "aceita um nível equilibrado de detalhe",
      detailed: "costuma pedir explicações mais detalhadas",
    },
    humor: {
      low: "quase não usa humor",
      medium: "usa humor ocasionalmente",
      high: "usa humor com frequência",
    },
  } as const;

  const aggregate: BehavioralAggregate = {
    objetividade: { code: profile.directness, label: facts.directness[profile.directness] },
    registro: { code: profile.register, label: facts.register[profile.register] },
    tecnicidade: { code: profile.technicality, label: facts.technicality[profile.technicality] },
    nivelDeDetalhe: { code: profile.detail, label: facts.detail[profile.detail] },
    humor: { code: profile.humor, label: facts.humor[profile.humor] },
  };

  return {
    aggregate,
    facts: Object.values(aggregate).map(dimension => dimension.label),
  };
}

export async function loadBehavioralHistory(
  userId: number,
  store: BehavioralMessageStore = db.bibbleMessage,
): Promise<BehavioralSample[]> {
  const messages = await store.findMany({
    where: {
      role: "user",
      session: { userId, onyxSessionId: null },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: BEHAVIOR_HISTORY_LIMIT,
    select: { content: true, createdAt: true },
  });

  return messages
    .reverse()
    .map(message => ({
      content: sanitizeBehaviorContent(message.content),
      createdAt: message.createdAt,
    }))
    .filter(message => message.content.length > 0);
}

/**
 * Produz uma leitura agregada do estilo de outro usuário sem devolver as
 * mensagens usadas como evidência. A resolução do alvo é limitada e recusa
 * ambiguidades; o executor é responsável pela autorização Admin/TI.
 */
export async function inspectBehavioralProfileByName(
  rawName: string,
  stores: { users: BehavioralUserStore; messages: BehavioralMessageStore } = {
    users: db.usuarios,
    messages: db.bibbleMessage,
  },
): Promise<BehavioralProfileInspection> {
  const query = rawName.replace(/\s+/gu, " ").trim();
  if (query.length < 2 || query.length > BEHAVIORAL_TARGET_NAME_MAX_CHARS) {
    return { status: "invalid_query", message: "Informe um nome entre 2 e 100 caracteres." };
  }

  const matches = await stores.users.findMany({
    where: { nome: { contains: query } },
    orderBy: [{ nome: "asc" }, { id: "asc" }],
    take: BEHAVIORAL_TARGET_MATCH_LIMIT,
    select: { id: true, nome: true },
  });
  if (matches.length === 0) {
    return { status: "not_found", query, message: `Nenhum usuário encontrado para "${query}".` };
  }

  const normalizedQuery = normalizePersonName(query);
  const exactMatches = matches.filter(user => normalizePersonName(user.nome) === normalizedQuery);
  const candidates = exactMatches.length > 0 ? exactMatches : matches;
  if (candidates.length !== 1) {
    return {
      status: "ambiguous",
      query,
      candidates: candidates.slice(0, BEHAVIORAL_TARGET_MATCH_LIMIT - 1).map(user => user.nome),
      truncated: candidates.length === BEHAVIORAL_TARGET_MATCH_LIMIT,
      message: "Há mais de um usuário compatível. Informe o nome completo exato.",
    };
  }

  const target = candidates[0];
  const history = await loadBehavioralHistory(target.id, stores.messages);
  const profile = classifyBehavioralStyle(history, "");
  const first = history[0]?.createdAt;
  const last = history.at(-1)?.createdAt;
  const period = first && last
    ? { first: first.toISOString(), last: last.toISOString() }
    : null;

  if (
    history.length < BEHAVIORAL_PROFILE_MIN_SAMPLE
    || profile.confidence < BEHAVIORAL_PROFILE_MIN_CONFIDENCE
  ) {
    return {
      status: "insufficient_sample",
      target: { name: target.nome },
      sampleSize: history.length,
      period,
      confidence: profile.confidence,
      confidenceLabel: confidenceLabel(profile),
      classifierVersion: profile.classifierVersion,
      insufficientSample: true,
      aggregate: null,
      facts: [],
      summary: `Ainda não há evidência consistente suficiente para caracterizar com segurança como ${target.nome} conversa com o Bibble.`,
    };
  }

  const aggregate = aggregateBehavioralProfile(profile);

  return {
    status: "ready",
    target: { name: target.nome },
    sampleSize: history.length,
    period,
    confidence: profile.confidence,
    confidenceLabel: confidenceLabel(profile),
    classifierVersion: profile.classifierVersion,
    insufficientSample: false,
    aggregate: aggregate.aggregate,
    facts: aggregate.facts,
    summary: `${target.nome} ${aggregate.facts.join("; ")}.`,
  };
}
