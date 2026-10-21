import "server-only";

import db from "@/lib/prisma";
import { isSameRole } from "@/lib/roles";
import { canonicalizarSetorLideranca } from "@/lib/setores-catalogo";
import { getCategoriasIniciaisDoSetor } from "@/lib/chamados/categorias-iniciais";
import { normalizarNomeCategoria } from "@/lib/chamados/catalogo";

/** CRUD pontual compartilhado pela action autenticada e pela CLI administrativa. */
export async function cadastrarSetor(nome: string) {
  const nomeCanonico = canonicalizarSetorLideranca(nome.trim().toUpperCase());
  if (!nomeCanonico) return { success: false as const, message: "Nome inválido" };

  const existe = await db.setor.findUnique({ where: { nome: nomeCanonico } });
  if (existe) return { success: false as const, message: "Setor já existe" };

  const criado = await db.$transaction(async (tx) => {
    const existentes = await tx.setor.findMany({ select: { nome: true } });
    if (existentes.some((setor) => isSameRole(setor.nome, nomeCanonico))) return null;
    const setor = await tx.setor.create({ data: { nome: nomeCanonico } });
    for (const categoria of getCategoriasIniciaisDoSetor(setor.nome)) {
      await tx.chamadoCategoria.create({ data: { ...categoria, setorId: setor.id, nomeNormalizado: normalizarNomeCategoria(categoria.nome) } });
    }
    return { id: setor.id, nome: setor.nome };
  }, { isolationLevel: "Serializable" });

  return criado
    ? { success: true as const, message: "Setor criado", setor: criado }
    : { success: false as const, message: "Já existe um setor com nome equivalente." };
}
