export type OpcaoSetorEquipe = { id: number; nome: string; usuarioIds: number[] };
export type VisaoQuadro = "MEUS" | "EQUIPE" | "SETOR" | "TODOS";
export type AcessoVisaoQuadro = { userId: number; admin: boolean; setores: OpcaoSetorEquipe[]; responsaveis?: { id: number; nome: string }[] };
export function usuariosDaVisao(acesso: AcessoVisaoQuadro, visao: VisaoQuadro, setorId?: number | null): number[] | null {
  if (visao === "MEUS") return [acesso.userId];
  if (visao === "TODOS") return null;
  if (visao === "SETOR") return acesso.setores.find((s) => s.id === setorId)?.usuarioIds ?? [];
  return [...new Set([acesso.userId, ...acesso.setores.flatMap((s) => s.usuarioIds)])];
}
