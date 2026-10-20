import { createHash } from "node:crypto";
import { avaliarGrupo, resolverCampo } from "@/lib/bpm/regras/avaliador";
import type { ContextoAvaliacao, GrupoCondicao } from "@/lib/bpm/regras/types";

export type AvisoMovimentoRd = {
  key: string;
  kind: "MISSING_DATA";
  nome: string;
  campoId?: string;
  requisitoId?: string;
  fase?: string;
};

export type ConfirmacaoPendenciasRd = {
  avisosHash: string;
  etapaOrigemEsperadaId: string;
  versaoEsperada: number;
  configVersion: number;
};

export function possuiOrigemImportadaRd(origem: { provider: string } | null | undefined): boolean {
  return origem?.provider === "RD_STATION_CRM_V1";
}

/** A true OR branch backed by existing data remains a hard business constraint. */
export function faltasQueAtivamCondicaoRd(grupo: GrupoCondicao, contexto: ContextoAvaliacao): string[] | null {
  const partes = grupo.condicoes.map(condicao => {
    if (!("tipo" in condicao)) return { ativa: avaliarGrupo(condicao, contexto), faltas: faltasQueAtivamCondicaoRd(condicao, contexto) };
    const ativa = avaliarGrupo({ operador: "AND", condicoes: [condicao] }, contexto);
    const valor = resolverCampo(condicao.campo, contexto);
    const ausente = valor == null || typeof valor === "string" && !valor.trim() || Array.isArray(valor) && valor.length === 0;
    return { ativa, faltas: ativa && ausente ? [`${condicao.campo.fonte}:${condicao.campo.campo}`] : null };
  }).filter(item => item.ativa);
  if (!partes.length || (grupo.operador === "OR" && partes.some(item => !item.faltas))) return null;
  const faltas = [...new Set(partes.flatMap(item => item.faltas ?? []))];
  return faltas.length ? faltas : null;
}

function canonico(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonico);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonico(item)]));
  }
  return value;
}

export function criarConfirmacaoPendenciasRd(input: {
  cardId: string;
  atorId: number;
  etapaOrigemEsperadaId: string;
  etapaDestinoId: string;
  versaoEsperada: number;
  configVersion: number;
  avisos: AvisoMovimentoRd[];
  origem: { id: string; provider: string; sourceDealId: string };
  configuracao: unknown;
  valores: unknown;
}): ConfirmacaoPendenciasRd {
  return {
    avisosHash: createHash("sha256").update(JSON.stringify(canonico(input))).digest("hex"),
    etapaOrigemEsperadaId: input.etapaOrigemEsperadaId,
    versaoEsperada: input.versaoEsperada,
    configVersion: input.configVersion,
  };
}

export function confirmacaoPendenciasRdCorresponde(
  recebida: ConfirmacaoPendenciasRd | undefined,
  atual: ConfirmacaoPendenciasRd,
): boolean {
  return recebida?.avisosHash === atual.avisosHash
    && recebida.etapaOrigemEsperadaId === atual.etapaOrigemEsperadaId
    && recebida.versaoEsperada === atual.versaoEsperada
    && recebida.configVersion === atual.configVersion;
}
