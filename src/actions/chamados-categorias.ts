"use server";

import { auth } from "../../auth";
import db from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { chamadoCategoriaSchema as categoriaSchema } from "@/lib/chamados/schemas";
import { obterAtorChamados } from "@/lib/chamados/acesso";
import { carregarCatalogoChamados, normalizarNomeCategoria } from "@/lib/chamados/catalogo";

export async function getChamadosCatalogo(incluirInativas = false) {
  const session = await auth();
  const ator = await obterAtorChamados(session?.user?.id);
  if (!ator) throw new Error("Não autorizado");
  if (incluirInativas && !ator.gerenciaCategorias) throw new Error("Somente TI pode gerenciar categorias.");
  return carregarCatalogoChamados(incluirInativas);
}
export async function salvarCategoriaChamado(input: z.input<typeof categoriaSchema>) {
  const session = await auth();
  const ator = await obterAtorChamados(session?.user?.id);
  if (!ator?.gerenciaCategorias) return { success: false, error: "Somente TI pode gerenciar categorias." };
  const parsed = categoriaSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const dados = parsed.data;
  try {
    await db.$transaction(async (tx) => {
      if (!(await obterAtorChamados(ator.id, tx))?.gerenciaCategorias) throw new Error("Somente TI pode gerenciar categorias.");
      const setor = await tx.setor.findUnique({ where: { id: dados.setorId }, select: { ativo: true, isBase: true } });
      if (!setor?.ativo || setor.isBase) throw new Error("Escolha um setor ativo.");
      if (dados.id) {
        const atual = await tx.chamadoCategoria.findUnique({ where: { id: dados.id }, select: { setorId: true } });
        if (!atual || atual.setorId !== dados.setorId) throw new Error("O setor de uma categoria existente não pode ser alterado.");
      }
      const data = { setorId: dados.setorId, nome: dados.nome, nomeNormalizado: normalizarNomeCategoria(dados.nome),
        ...(dados.descricao !== undefined ? { descricao: dados.descricao || null } : {}),
        ...(dados.ativo !== undefined ? { ativo: dados.ativo } : {}), ...(dados.ordem !== undefined ? { ordem: dados.ordem } : {}) };
      if (dados.id) await tx.chamadoCategoria.update({ where: { id: dados.id }, data });
      else await tx.chamadoCategoria.create({ data });
    }, { isolationLevel: "Serializable" });
    revalidatePath("/PainelAlpha/Chamados");
    return { success: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { success: false, error: "Já existe uma categoria com este nome no setor." };
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível salvar a categoria." };
  }
}
export async function excluirCategoriaChamado(id: number) {
  const session = await auth();
  const ator = await obterAtorChamados(session?.user?.id);
  if (!ator?.gerenciaCategorias) return { success: false, error: "Somente TI pode gerenciar categorias." };
  if (!Number.isInteger(id) || id <= 0) return { success: false, error: "Categoria inválida" };
  try {
    const arquivada = await db.$transaction(async (tx) => {
      if (!(await obterAtorChamados(ator.id, tx))?.gerenciaCategorias) throw new Error("Somente TI pode gerenciar categorias.");
      const categoria = await tx.chamadoCategoria.findUnique({ where: { id }, select: { id: true } });
      if (!categoria) throw new Error("Categoria não encontrada.");
      const utilizada = await tx.chamados.count({ where: { categoriaId: id } });
      if (utilizada) { await tx.chamadoCategoria.update({ where: { id }, data: { ativo: false } }); return true; }
      // Restrict no banco impede excluir se uma criação concorrente usar a categoria.
      await tx.chamadoCategoria.delete({ where: { id } });
      return false;
    }, { isolationLevel: "Serializable" });
    revalidatePath("/PainelAlpha/Chamados");
    return { success: true, arquivada };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      await db.$transaction(async (tx) => {
        if (!(await obterAtorChamados(ator.id, tx))?.gerenciaCategorias) throw new Error("Somente TI pode gerenciar categorias.");
        await tx.chamadoCategoria.update({ where: { id }, data: { ativo: false } });
      }, { isolationLevel: "Serializable" });
      revalidatePath("/PainelAlpha/Chamados");
      return { success: true, arquivada: true };
    }
    return { success: false, error: error instanceof Error ? error.message : "Não foi possível excluir a categoria." };
  }
}
