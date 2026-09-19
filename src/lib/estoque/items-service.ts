import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { del } from "@vercel/blob";
import { z } from "zod";
import db from "@/lib/prisma";

const idSchema = z.string().trim().min(1).max(100);
const nonNegativeInteger = z.coerce.number().int().min(0).max(1_000_000);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const optionalDate = z.union([z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).nullable().optional();

export const inventoryItemInputSchema = z.object({
  id: idSchema.optional(),
  nome: z.string().trim().min(2).max(160),
  quantidade: nonNegativeInteger.default(0),
  estoqueMinimo: nonNegativeInteger.default(0),
  unidade: z.string().trim().min(1).max(30),
  categoriaId: idSchema,
  descricao: optionalText(2_000),
  marca: optionalText(120),
  modelo: optionalText(120),
  codigoInterno: optionalText(100),
  trackingMode: z.enum(["QUANTIDADE", "INDIVIDUAL"]).default("QUANTIDADE"),
  usagePolicy: z.enum(["RETORNAVEL", "CONSUMIVEL"]).default("RETORNAVEL"),
  defaultLocationId: z.union([idSchema, z.literal("")]).nullable().optional(),
  observacoes: optionalText(4_000),
  dataAquisicao: optionalDate,
  valorAquisicaoCentavos: z.union([nonNegativeInteger, z.literal("")]).nullable().optional(),
  fornecedor: optionalText(160),
});

export interface InventoryItemServiceActor {
  userId: number;
  name: string;
}

export class InventoryItemServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryItemServiceError";
  }
}

function safeJson(value: unknown) {
  return JSON.stringify(value).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 8_000);
}

async function writeItemAudit(tx: Prisma.TransactionClient, input: {
  actor: InventoryItemServiceActor;
  itemId: string;
  action: string;
  oldData?: unknown;
  newData?: unknown;
}) {
  await Promise.all([
    tx.auditoria.create({
      data: { userId: input.actor.userId, acao: input.action, detalhes: safeJson({ itemId: input.itemId, oldData: input.oldData, newData: input.newData }).slice(0, 1_500) },
    }),
    tx.inventoryAuditLog.create({
      data: {
        id: randomUUID(), entityType: "ProdutoEstoque", entityId: input.itemId, action: input.action,
        actorType: "USER", actorUserId: input.actor.userId, actorNameSnapshot: input.actor.name,
        oldDataJson: input.oldData === undefined ? null : safeJson(input.oldData),
        newDataJson: input.newData === undefined ? null : safeJson(input.newData), requestId: randomUUID(),
      },
    }),
  ]);
}

export async function saveInventoryItem(payload: unknown, actor: InventoryItemServiceActor, client: PrismaClient = db) {
  const data = inventoryItemInputSchema.parse(payload);
  if (!data.id && data.quantidade > 0) throw new InventoryItemServiceError("Cadastre o item com saldo zero e registre uma entrada no ledger.");

  try {
    return await client.$transaction(async (tx) => {
      const category = await tx.categoria.findFirst({ where: { id: data.categoriaId, ativo: true, archivedAt: null }, select: { id: true } });
      if (!category) throw new InventoryItemServiceError("Categoria informada não existe ou está inativa.");
      if (data.defaultLocationId) {
        const location = await tx.inventoryLocation.findFirst({ where: { id: data.defaultLocationId, ativo: true, archivedAt: null }, select: { id: true } });
        if (!location) throw new InventoryItemServiceError("Localização informada não existe ou está inativa.");
      }
      const commonData = {
        nome: data.nome, estoqueMinimo: data.estoqueMinimo, unidade: data.unidade, categoriaId: data.categoriaId,
        descricao: data.descricao || null, marca: data.marca || null, modelo: data.modelo || null,
        codigoInterno: data.codigoInterno || null, trackingMode: data.trackingMode, usagePolicy: data.usagePolicy,
        defaultLocationId: data.defaultLocationId || null, observacoes: data.observacoes || null,
        dataAquisicao: data.dataAquisicao ? new Date(`${data.dataAquisicao}T12:00:00.000Z`) : null,
        valorAquisicaoCentavos: data.valorAquisicaoCentavos === "" || data.valorAquisicaoCentavos == null ? null : data.valorAquisicaoCentavos,
        fornecedor: data.fornecedor || null, updatedById: actor.userId,
      };
      if (data.id) {
        const previous = await tx.produtoEstoque.findFirst({ where: { id: data.id, archivedAt: null } });
        if (!previous) throw new InventoryItemServiceError("Item não encontrado ou arquivado.");
        if (previous.trackingMode !== data.trackingMode) {
          const [assets, movements, balances] = await Promise.all([
            tx.inventoryAsset.count({ where: { produtoId: data.id } }),
            tx.inventoryMovement.count({ where: { produtoId: data.id } }),
            tx.inventoryStockBalance.count({ where: { produtoId: data.id } }),
          ]);
          if (previous.quantidade !== 0 || assets > 0 || movements > 0 || balances > 0) {
            throw new InventoryItemServiceError("Tipo de controle não pode mudar depois que o item possui saldo, unidade ou histórico.");
          }
        }
        const updated = await tx.produtoEstoque.update({ where: { id: data.id }, data: commonData });
        await writeItemAudit(tx, { actor, itemId: data.id, action: "ESTOQUE_ITEM_EDITADO", oldData: previous, newData: updated });
        return { id: data.id, created: false };
      }
      const created = await tx.produtoEstoque.create({ data: { ...commonData, quantidade: 0, quantidadeTotal: 0, status: "SEM_ESTOQUE", imagem: null, createdById: actor.userId } });
      await writeItemAudit(tx, { actor, itemId: created.id, action: "ESTOQUE_ITEM_CRIADO", oldData: null, newData: created });
      return { id: created.id, created: true };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new InventoryItemServiceError("Código interno já está cadastrado em outro item.");
    }
    throw error;
  }
}

export async function archiveInventoryItem(itemId: string, actor: InventoryItemServiceActor, client: PrismaClient = db) {
  const id = idSchema.parse(itemId);
  return client.$transaction(async (tx) => {
    const product = await tx.produtoEstoque.findFirst({ where: { id, archivedAt: null } });
    if (!product) throw new InventoryItemServiceError("Item não encontrado ou já arquivado.");
    if (product.quantidadeTotal > 0 || product.quantidade > 0) throw new InventoryItemServiceError("Item com saldo não pode ser arquivado. Registre a baixa ou saída antes.");
    const [activeAssignments, openMaintenances] = await Promise.all([
      tx.inventoryAssignment.count({
        where: {
          status: { in: ["ATIVA", "PARCIALMENTE_DEVOLVIDA"] },
          OR: [{ produtoId: id }, { movements: { some: { produtoId: id } } }],
        },
      }),
      tx.inventoryMaintenance.count({ where: { produtoId: id, status: "ABERTA" } }),
    ]);
    if (activeAssignments > 0 || openMaintenances > 0) throw new InventoryItemServiceError("Item com atribuição ou manutenção ativa não pode ser arquivado.");
    const archivedAt = new Date();
    await tx.produtoEstoque.update({ where: { id }, data: { archivedAt, updatedById: actor.userId } });
    await writeItemAudit(tx, { actor, itemId: id, action: "ESTOQUE_ITEM_ARQUIVADO", oldData: product, newData: { archivedAt } });
    return { id, archived: true };
  });
}

/** Exclusão física limitada a cadastros sem histórico operacional ou referência em modelos de Kit. */
export async function deleteInventoryItemPermanently(itemId: string, actor: InventoryItemServiceActor, client: PrismaClient = db) {
  const id = idSchema.parse(itemId);
  const result = await client.$transaction(async (tx) => {
    const product = await tx.produtoEstoque.findUnique({ where: { id } });
    if (!product) throw new InventoryItemServiceError("Item não encontrado.");

    const [movements, assignments, maintenances, kitComponents, returnLines, kitRequirements, balances] = await Promise.all([
      tx.inventoryMovement.count({ where: { produtoId: id } }),
      tx.inventoryAssignment.count({ where: { produtoId: id } }),
      tx.inventoryMaintenance.count({ where: { produtoId: id } }),
      tx.inventoryKitComponent.count({ where: { produtoId: id } }),
      tx.inventoryReturnLine.count({ where: { produtoId: id } }),
      tx.inventoryTagRequirement.count({ where: { produtoId: id } }),
      tx.inventoryStockBalance.findMany({ where: { produtoId: id }, select: { quantity: true } }),
    ]);
    if (movements || assignments || maintenances || kitComponents || returnLines) {
      throw new InventoryItemServiceError("Este item possui movimentação, atribuição, manutenção ou histórico de Kit e não pode ser excluído definitivamente. Use Arquivar item.");
    }
    if (kitRequirements) {
      throw new InventoryItemServiceError("Remova este item da composição das Tags/Kits antes de excluí-lo.");
    }
    if (
      product.quantidade !== 0 || product.quantidadeTotal !== 0 || product.quantidadeEmUso !== 0
      || product.quantidadeReservada !== 0 || product.quantidadeManutencao !== 0 || product.quantidadeDanificada !== 0
      || balances.some((balance) => balance.quantity !== 0)
    ) {
      throw new InventoryItemServiceError("O item ainda possui saldo. Zere o estoque antes da exclusão definitiva.");
    }

    const assets = await tx.inventoryAsset.findMany({ where: { produtoId: id }, select: { id: true } });
    const assetIds = assets.map((asset) => asset.id);
    const images = await tx.inventoryImage.findMany({
      where: { OR: [{ produtoId: id }, ...(assetIds.length ? [{ assetId: { in: assetIds } }] : [])] },
      select: { url: true, storageProvider: true },
    });

    await writeItemAudit(tx, { actor, itemId: id, action: "ESTOQUE_ITEM_EXCLUIDO_DEFINITIVAMENTE", oldData: product, newData: null });
    await tx.inventoryImage.deleteMany({ where: { OR: [{ produtoId: id }, ...(assetIds.length ? [{ assetId: { in: assetIds } }] : [])] } });
    await tx.inventoryAsset.deleteMany({ where: { produtoId: id } });
    await tx.inventoryStockBalance.deleteMany({ where: { produtoId: id } });
    await tx.inventoryItemTag.deleteMany({ where: { produtoId: id } });
    await tx.listaCompra.deleteMany({ where: { produtoId: id } });
    await tx.produtoEstoque.delete({ where: { id } });
    return { id, deleted: true as const, blobUrls: images.filter((image) => image.storageProvider === "vercel-blob").map((image) => image.url) };
  });

  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (token && result.blobUrls.length > 0) {
    await del(result.blobUrls, { token }).catch(() => undefined);
  }
  return result;
}
