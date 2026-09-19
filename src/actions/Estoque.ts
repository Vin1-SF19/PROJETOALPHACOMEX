"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import db from "@/lib/prisma";
import { requireInventoryManager } from "@/lib/estoque/authorization";
import { InventoryDomainError } from "@/lib/estoque/movement-domain";
import { recordInventoryPurchase } from "@/lib/estoque/movement-service";
import { archiveInventoryItem, deleteInventoryItemPermanently, InventoryItemServiceError, saveInventoryItem } from "@/lib/estoque/items-service";

const idSchema = z.string().trim().min(1).max(100);
const positiveInteger = z.coerce.number().int().positive().max(1_000_000);

const categoryNameSchema = z.string().trim().min(2).max(80);
const categoryPayloadSchema = z.object({
  id: idSchema.optional(),
  nome: categoryNameSchema,
  cor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Informe uma cor hexadecimal válida.").default("#6366f1"),
  icone: z.string().trim().min(1).max(50).default("Package"),
  descricao: z.string().trim().max(300).nullable().optional(),
});

function inventoryError(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? fallback;
  if (error instanceof InventoryDomainError) return error.message;
  if (error instanceof InventoryItemServiceError) return error.message;
  if (
    error instanceof Error &&
    ["Sem permissão", "Cadastre o item", "Item não encontrado", "Não é possível excluir categorias", "Tipo de controle", "Localização"].some((prefix) =>
      error.message.startsWith(prefix),
    )
  ) return error.message;
  return fallback;
}

function revalidateInventory() {
  revalidatePath("/PainelAlpha/Estoque");
  revalidatePath("/PainelAlpha/PainelTarefas/painelTarefaSG");
  revalidatePath("/PainelAlpha/PainelTarefas/painelTarefaSG/PainelEstoque");
}

function auditDetails(details: Record<string, unknown>): string {
  return JSON.stringify(details).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 1_500);
}

export async function SalvarProduto(payload: unknown) {
  try {
    const actor = await requireInventoryManager();
    const user = await db.usuarios.findUnique({ where: { id: actor.userId }, select: { nome: true } });
    const result = await saveInventoryItem(payload, {
      userId: actor.userId,
      name: user?.nome ?? `Usuário #${actor.userId}`,
    });

    revalidateInventory();
    return { success: true as const, itemId: result.id };
  } catch (error) {
    return { success: false as const, error: inventoryError(error, "Não foi possível salvar o item.") };
  }
}

export async function buscarProdutos(options: { limit?: number } = {}) {
  await requireInventoryManager();
  // Compatibilidade para os consumidores legados, sem permitir que eles
  // materializem o catálogo inteiro conforme o Estoque Geral cresce.
  const limit = z.coerce.number().int().min(1).max(250).parse(options.limit ?? 200);
  return db.produtoEstoque.findMany({
    where: { archivedAt: null },
    include: {
      categoria: true,
      inventoryBalances: { include: { location: true }, orderBy: { updatedAt: "desc" } },
      inventoryAssets: { where: { archivedAt: null }, orderBy: { createdAt: "asc" } },
      inventoryImages: {
        where: { isPrimary: false, deletedAt: null, objectKey: { contains: "/notas-fiscais/" } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { nome: "asc" },
    take: limit,
  });
}

export async function buscarResumoEstoque() {
  await requireInventoryManager();
  const [summary] = await db.$queryRaw<Array<{
    itensCadastrados: bigint | number;
    disponiveis: bigint | number;
    emUso: bigint | number;
    estoqueBaixo: bigint | number;
  }>>`
    SELECT
      COUNT(*) AS itensCadastrados,
      COALESCE(SUM(MAX(quantidade, 0)), 0) AS disponiveis,
      COALESCE(SUM(MAX(quantidadeEmUso, 0)), 0) AS emUso,
      COALESCE(SUM(CASE WHEN quantidade <= estoqueMinimo THEN 1 ELSE 0 END), 0) AS estoqueBaixo
    FROM ProdutoEstoque
    WHERE archivedAt IS NULL
  `;
  return {
    itensCadastrados: Number(summary?.itensCadastrados ?? 0),
    disponiveis: Number(summary?.disponiveis ?? 0),
    emUso: Number(summary?.emUso ?? 0),
    estoqueBaixo: Number(summary?.estoqueBaixo ?? 0),
  };
}

export async function buscarLocalizacoes() {
  await requireInventoryManager();
  return db.inventoryLocation.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } });
}

export async function DeletarProduto(id: string) {
  try {
    await requireInventoryManager();
    idSchema.parse(id);
    return {
      success: false as const,
      error: "Exclusão física foi desativada para preservar o histórico. Use arquivamento após a ativação do modelo aditivo.",
    };
  } catch (error) {
    return { success: false as const, error: inventoryError(error, "Item inválido.") };
  }
}

export async function ArquivarProduto(id: string) {
  try {
    const actor = await requireInventoryManager();
    const user = await db.usuarios.findUnique({ where: { id: actor.userId }, select: { nome: true } });
    await archiveInventoryItem(id, {
      userId: actor.userId,
      name: user?.nome ?? `Usuário #${actor.userId}`,
    });
    revalidateInventory();
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: inventoryError(error, "Não foi possível arquivar o item.") };
  }
}

export async function ExcluirProdutoDefinitivamente(id: string, confirmation: string) {
  try {
    const actor = await requireInventoryManager();
    if (confirmation !== "EXCLUIR") throw new InventoryItemServiceError("Confirmação inválida. Digite EXCLUIR para continuar.");
    const user = await db.usuarios.findUnique({ where: { id: actor.userId }, select: { nome: true } });
    const result = await deleteInventoryItemPermanently(id, {
      userId: actor.userId,
      name: user?.nome ?? `Usuário #${actor.userId}`,
    });
    revalidateInventory();
    return { success: true as const, data: result };
  } catch (error) {
    return { success: false as const, error: inventoryError(error, "Não foi possível excluir definitivamente o item.") };
  }
}

export async function SalvarCategoria(payload: unknown) {
  try {
    const actor = await requireInventoryManager();
    const parsed = categoryPayloadSchema.parse(typeof payload === "string" ? { nome: payload } : payload);
    const data = {
      nome: parsed.nome.toLocaleUpperCase("pt-BR"),
      cor: parsed.cor,
      icone: parsed.icone,
      descricao: parsed.descricao || null,
      updatedAt: new Date(),
    };
    const category = await db.$transaction(async (tx) => {
      if (parsed.id) {
        const current = await tx.categoria.findFirst({ where: { id: parsed.id, ativo: true, archivedAt: null } });
        if (!current) throw new Error("Categoria não encontrada.");
        const updated = await tx.categoria.update({ where: { id: parsed.id }, data });
        await tx.auditoria.create({
          data: {
            userId: actor.userId,
            acao: "ESTOQUE_CATEGORIA_EDITADA",
            detalhes: auditDetails({
              categoriaId: updated.id,
              anterior: { nome: current.nome, cor: current.cor, icone: current.icone, descricao: current.descricao },
              novo: { nome: updated.nome, cor: updated.cor, icone: updated.icone, descricao: updated.descricao },
            }),
          },
        });
        return updated;
      }
      const created = await tx.categoria.create({ data });
      await tx.auditoria.create({ data: { userId: actor.userId, acao: "ESTOQUE_CATEGORIA_CRIADA", detalhes: auditDetails({ categoriaId: created.id, nome: created.nome }) } });
      return created;
    });
    revalidateInventory();
    return { success: true as const, data: category };
  } catch (error) {
    return { success: false as const, error: inventoryError(error, error instanceof Error && error.message === "Categoria não encontrada." ? error.message : "Categoria já existe ou não pôde ser salva.") };
  }
}

export async function buscarCategorias() {
  await requireInventoryManager();
  return db.categoria.findMany({ where: { ativo: true, archivedAt: null }, orderBy: { nome: "asc" } });
}

export async function DeletarCategoria(id: string) {
  try {
    const actor = await requireInventoryManager();
    const categoryId = idSchema.parse(id);
    await db.$transaction(async (tx) => {
      const relatedItems = await tx.produtoEstoque.count({ where: { categoriaId: categoryId } });
      if (relatedItems > 0) throw new Error("Não é possível excluir categorias com produtos ativos.");
      await tx.categoria.delete({ where: { id: categoryId } });
      await tx.auditoria.create({ data: { userId: actor.userId, acao: "ESTOQUE_CATEGORIA_EXCLUIDA", detalhes: auditDetails({ categoriaId: categoryId }) } });
    });
    revalidateInventory();
    return { success: true as const, id: categoryId };
  } catch (error) {
    return { success: false as const, error: inventoryError(error, error instanceof Error ? error.message : "Não foi possível excluir a categoria.") };
  }
}

export async function RegistrarCompra(
  produtoId: string,
  quantidadeComprada: number,
  idempotencyKey: string,
) {
  try {
    const actor = await requireInventoryManager();
    const parsedId = idSchema.parse(produtoId);
    const quantity = positiveInteger.parse(quantidadeComprada);
    const parsedKey = z.string().trim().min(8).max(200).parse(idempotencyKey);
    const user = await db.usuarios.findFirst({
      where: { id: actor.userId, status: "ATIVO" },
      select: { nome: true },
    });
    if (!user) throw new Error("Usuário responsável inexistente ou inativo.");

    await recordInventoryPurchase({
      idempotencyKey: parsedKey,
      produtoId: parsedId,
      quantity,
      observacao: "Entrada confirmada pela Lista de Compras",
      metadata: { source: "LISTA_COMPRA" },
      actor: {
        actorType: "USER",
        actorUserId: actor.userId,
        actorName: user.nome,
      },
    });
    revalidateInventory();
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: inventoryError(error, "Não foi possível registrar a compra.") };
  }
}

const cartProductSchema = z.object({
  id: idSchema,
});

export async function AdicionarAoCarrinho(payload: unknown) {
  try {
    const actor = await requireInventoryManager();
    const { id: produtoId } = cartProductSchema.parse(payload);
    await db.$transaction(async (tx) => {
      const product = await tx.produtoEstoque.findFirst({
        where: { id: produtoId, archivedAt: null },
        select: { id: true, nome: true, quantidade: true, estoqueMinimo: true, unidade: true, categoriaId: true },
      });
      if (!product) throw new Error("Item não encontrado.");
      await tx.listaCompra.upsert({
        where: { produtoId: product.id },
        update: { status: "CARRINHO", nome: product.nome, quantidadeAtual: product.quantidade, minimoEsperado: product.estoqueMinimo, categoriaId: product.categoriaId },
        create: { produtoId: product.id, nome: product.nome, quantidadeAtual: product.quantidade, minimoEsperado: product.estoqueMinimo, unidade: product.unidade, status: "CARRINHO", categoriaId: product.categoriaId },
      });
      await tx.auditoria.create({ data: { userId: actor.userId, acao: "ESTOQUE_ITEM_ADICIONADO_CARRINHO", detalhes: auditDetails({ itemId: product.id }) } });
    });
    revalidateInventory();
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: inventoryError(error, "Não foi possível adicionar o item ao carrinho.") };
  }
}

export async function ConfirmarCarrinhoParaLista() {
  try {
    const actor = await requireInventoryManager();
    await db.$transaction(async (tx) => {
      const result = await tx.listaCompra.updateMany({ where: { status: "CARRINHO" }, data: { status: "PENDENTE" } });
      await tx.auditoria.create({ data: { userId: actor.userId, acao: "ESTOQUE_CARRINHO_CONFIRMADO", detalhes: auditDetails({ itens: result.count }) } });
    });
    revalidateInventory();
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: inventoryError(error, "Não foi possível confirmar o carrinho.") };
  }
}

export async function RemoverDaLista(produtoId: string) {
  try {
    const actor = await requireInventoryManager();
    const parsedId = idSchema.parse(produtoId);
    await db.$transaction(async (tx) => {
      await tx.listaCompra.deleteMany({ where: { produtoId: parsedId } });
      await tx.auditoria.create({ data: { userId: actor.userId, acao: "ESTOQUE_ITEM_REMOVIDO_LISTA", detalhes: auditDetails({ itemId: parsedId }) } });
    });
    revalidateInventory();
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: inventoryError(error, "Não foi possível remover o item da lista.") };
  }
}

export async function buscarListaCompra() {
  await requireInventoryManager();
  return db.listaCompra.findMany({ include: { categoria: true }, orderBy: { createdAt: "desc" } });
}

export async function VerificarAlertaEstoque(produtoId: string) {
  try {
    await requireInventoryManager();
    const parsedId = idSchema.parse(produtoId);
    const product = await db.produtoEstoque.findUnique({ where: { id: parsedId } });
    if (!product || product.quantidade > product.estoqueMinimo) return { success: true as const };
    await db.listaCompra.upsert({
      where: { produtoId: product.id },
      update: { status: "PENDENTE", quantidadeAtual: product.quantidade, minimoEsperado: product.estoqueMinimo, nome: product.nome, categoriaId: product.categoriaId },
      create: { produtoId: product.id, nome: product.nome, quantidadeAtual: product.quantidade, minimoEsperado: product.estoqueMinimo, unidade: product.unidade || "un", status: "PENDENTE", categoriaId: product.categoriaId },
    });
    revalidateInventory();
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: inventoryError(error, "Não foi possível verificar o alerta.") };
  }
}
