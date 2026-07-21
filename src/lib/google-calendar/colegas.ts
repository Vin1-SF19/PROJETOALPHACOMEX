/** Paleta fixa para diferenciar colegas na grade — atribuída automaticamente por ordem de adição. */
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
] as const;

export function proximaCorColega(quantidadeAtual: number): string {
  return PALETA_CORES_COLEGAS[quantidadeAtual % PALETA_CORES_COLEGAS.length];
}

export function isAdminRole(role: string | undefined): boolean {
  return role === "Admin" || role === "CEO";
}
