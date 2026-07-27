export const STATUS_LABELS: Record<string, string> = {
  IDEA: "Sistemas a fazer",
  PRONTO_ESPECIFICACAO: "Prontos p/ especificação",
  EM_ESPECIFICACAO: "Em planejamento",
  PRONTO_DESENVOLVIMENTO: "Prontos p/ desenvolvimento",
  EM_DESENVOLVIMENTO: "Em desenvolvimento",
  EM_REVISAO: "Em revisão",
  CONCLUIDO: "Prontos",
  ARQUIVADO: "Arquivado",
};

export const STATUS_ORDEM = [
  "IDEA",
  "PRONTO_ESPECIFICACAO",
  "EM_ESPECIFICACAO",
  "PRONTO_DESENVOLVIMENTO",
  "EM_DESENVOLVIMENTO",
  "EM_REVISAO",
  "CONCLUIDO",
] as const;

export const PRIORIDADE_CONFIG: Record<string, { label: string; cor: string; icone: string }> = {
  BAIXA: { label: "Baixa", cor: "148,163,184", icone: "ArrowDown" },
  NORMAL: { label: "Normal", cor: "96,165,250", icone: "Minus" },
  ALTA: { label: "Alta", cor: "251,191,36", icone: "ArrowUp" },
  URGENTE: { label: "Urgente", cor: "251,146,60", icone: "AlertTriangle" },
  CRITICA: { label: "Crítica", cor: "248,113,113", icone: "Siren" },
};

export interface ProjetoBlueprintCard {
  id: string;
  code: string;
  title: string;
  summary: string | null;
  status: string;
  priority: string;
  progress: number;
  setor: string | null;
  coverUrl: string | null;
  icon: string | null;
  tagsJson: string | null;
  dueDate: string | Date | null;
  updatedAt: string | Date;
  requester?: { id: number; nome: string } | null;
  owner?: { id: number; nome: string } | null;
  developer?: { id: number; nome: string } | null;
  perguntasAbertas?: number;
  _count?: { files: number; requirements: number; questions: number };
}

/**
 * Converte um valor de `<input type="date">` (string "YYYY-MM-DD") em Date sem risco de
 * deslocar um dia por fuso horário — `new Date("2026-07-30")` é interpretado como UTC
 * meia-noite, que em fusos negativos (Brasil) pode exibir "29/07" na volta. Interpretando
 * como meio-dia local, a data civil sempre bate independente do fuso do navegador/servidor.
 */
export function dataInputParaDate(valor: string): Date | undefined {
  if (!valor) return undefined;
  const [ano, mes, dia] = valor.split("-").map(Number);
  if (!ano || !mes || !dia) return undefined;
  return new Date(ano, mes - 1, dia, 12, 0, 0);
}

export function parseTags(tagsJson: string | null): string[] {
  if (!tagsJson) return [];
  try {
    const parsed = JSON.parse(tagsJson);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}
