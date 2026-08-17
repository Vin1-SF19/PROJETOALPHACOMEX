/**
 * Paleta fixa para diferenciar colegas/calendários na grade — atribuída automaticamente por
 * ordem de adição (`proximaCorColega`) e também oferecida como opção de escolha manual em
 * `SeletorCorPaleta` (substituiu o `<input type="color">` nativo, que disparava `onChange` a
 * cada frame de arraste do picker do SO — dezenas de Server Actions concorrentes sem debounce).
 */
import { isAdminRole as hasAdminAccess } from "@/lib/roles";

export const PALETA_CORES_COLEGAS = [
  "#f97316", // laranja
  "#a855f7", // roxo
  "#14b8a6", // teal
  "#ec4899", // pink
  "#84cc16", // lima
  "#06b6d4", // ciano
  "#f43f5e", // rosa-vermelho
  "#eab308", // amarelo
  "#8b5cf6", // violeta
  "#22c55e", // verde
  "#3b82f6", // azul
  "#ef4444", // vermelho
  "#10b981", // esmeralda
  "#6366f1", // índigo
  "#d946ef", // fúcsia
  "#78716c", // pedra
] as const;

export function proximaCorColega(quantidadeAtual: number): string {
  return PALETA_CORES_COLEGAS[quantidadeAtual % PALETA_CORES_COLEGAS.length];
}

export function isAdminRole(role: string | undefined): boolean {
  return hasAdminAccess(role);
}
