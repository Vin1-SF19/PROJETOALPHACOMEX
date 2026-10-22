import type { TipoEmbasamento } from "@prisma/client";

export interface ChecklistItemTemplate {
  codigo: string;
  secao: string;
  descricao: string;
  complemento?: string;
  obrigatorio: boolean;
}

// ─── SEÇÕES ──────────────────────────────────────────────────────────────────
export const SECOES = {
  CONSTITUICAO: "CONSTITUIÇÃO REGULAR",
  CAP_OPERACIONAL: "CAPACIDADE OPERACIONAL",
  CAP_FINANCEIRA: "CAPACIDADE FINANCEIRA",
  CAPITAL_SOCIAL: "ORIGEM DO CAPITAL SOCIAL",
  VALIDACAO: "VALIDAÇÃO",
} as const;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

export const TIPO_LABELS: Record<TipoEmbasamento, string> = {
  RECEITA_BRUTA_DAS: "Receita Bruta DAS",
  RECEITA_BRUTA_CPRB: "Receita Bruta CPRB",
  INICIO_RETOMADA: "Início ou Retomada",
  DISPONIBILIDADE_FINANCEIRA: "Disponibilidade Financeira",
};

export const TIPO_CORES: Record<TipoEmbasamento, string> = {
  RECEITA_BRUTA_DAS: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  RECEITA_BRUTA_CPRB: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  INICIO_RETOMADA: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  DISPONIBILIDADE_FINANCEIRA:
    "text-amber-400 bg-amber-500/10 border-amber-500/20",
};

export const STATUS_LABELS: Record<string, string> = {
  FALAR_DR_EDVAN: "Falar com Dr. Edvan (legado)",
  FALAR_ANDREW: "Falar com Andrew (legado)",
  PENDENTE: "Pendente",
  OK: "OK",
  IRREGULAR: "Irregular",
  PARCIALMENTE_IRREGULAR: "Parc. Irregular",
  REVISAR: "Revisar",
  DESNECESSARIO: "Desnecessário",
  EM_ANALISE: "Em Análise",
  AGUARDANDO_DOCUMENTOS: "Aguardando Docs",
  PRIORIDADE: "Prioridade",
};

export const STATUS_CORES: Record<string, string> = {
  FALAR_DR_EDVAN: "text-slate-400 bg-slate-500/10 border-slate-500/20",
  FALAR_ANDREW: "text-slate-400 bg-slate-500/10 border-slate-500/20",
  PENDENTE: "text-slate-400 bg-slate-500/10 border-slate-500/20",
  OK: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  IRREGULAR: "text-red-400 bg-red-500/10 border-red-500/20",
  PARCIALMENTE_IRREGULAR:
    "text-orange-400 bg-orange-500/10 border-orange-500/20",
  REVISAR: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  DESNECESSARIO: "text-slate-600 bg-slate-800/50 border-slate-700/30",
  EM_ANALISE: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  AGUARDANDO_DOCUMENTOS:
    "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  PRIORIDADE: "text-red-400 bg-red-500/10 border-red-500/20",
};

export const STATUS_CONCLUIDOS = new Set(["OK", "DESNECESSARIO"]);

export function calcularProgressoItens(
  itens: { status: string; obrigatorio: boolean }[],
): number {
  return resumirChecklist(itens).percentual;
}

export function resumirChecklist(
  itens: { status: string; obrigatorio: boolean }[] | null,
): import("./types").ResumoChecklist {
  const total = itens?.filter((i) => i.obrigatorio).length ?? 0;
  const concluidos =
    itens?.filter((i) => i.obrigatorio && STATUS_CONCLUIDOS.has(i.status))
      .length ?? 0;
  return {
    estado:
      itens === null
        ? "SEM_CHECKLIST"
        : itens.length === 0
          ? "SEM_ITENS"
          : total > 0 && concluidos === total
            ? "COMPLETO"
            : "EM_ANDAMENTO",
    total,
    concluidos,
    pendentes: total - concluidos,
    percentual: total ? Math.round((concluidos / total) * 100) : 0,
    semObrigatorios: total === 0,
  };
}
export function resolverChecklistAtivo<T extends { tipo: string }>(
  tipo: string | null,
  checklists: T[],
): T | null {
  return tipo ? (checklists.find((c) => c.tipo === tipo) ?? null) : null;
}
