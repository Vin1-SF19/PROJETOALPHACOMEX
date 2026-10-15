import db from "@/lib/prisma";
import { isSameRole, normalizeRole } from "@/lib/roles";

export async function carregarCatalogoChamados(incluirInativas = false) {
  const setores = await db.setor.findMany({ where: { ativo: true, isBase: false }, select: { id: true, nome: true }, orderBy: { nome: "asc" } });
  const [categorias, usuarios] = await Promise.all([
    db.chamadoCategoria.findMany({ where: { setorId: { in: setores.map((s) => s.id) }, ...(incluirInativas ? {} : { ativo: true }) },
      select: { id: true, setorId: true, nome: true, descricao: true, ativo: true, ordem: true }, orderBy: [{ ordem: "asc" }, { nome: "asc" }] }),
    db.usuarios.findMany({ where: { status: "ATIVO" }, select: { id: true, nome: true, role: true }, orderBy: { nome: "asc" } }),
  ]);
  const responsaveis = usuarios.flatMap((usuario) => {
    const matches = setores.filter((setor) => isSameRole(setor.nome, usuario.role));
    return matches.length === 1 ? [{ id: usuario.id, nome: usuario.nome, setorId: matches[0].id }] : [];
  });
  return { setores, categorias, responsaveis };
}
export function normalizarNomeCategoria(nome: string): string {
  return normalizeRole(nome);
}
