"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import db from "@/lib/prisma";
import { requireInventoryManager, requireInventoryReturnApprover } from "@/lib/estoque/authorization";
import { InventoryDomainError } from "@/lib/estoque/movement-domain";
import { executeInventoryBatchInTransaction } from "@/lib/estoque/movement-service";
import {
  deliverInventoryKitSchema,
  INVENTORY_KIT_ACTIVE_STATUSES,
  INVENTORY_KIT_COMPONENT_ACTIVE_STATUSES,
  kitStatusAfterReturn,
  returnInventoryKitSchema,
  saveInventoryKitComponentsSchema,
  validateInventoryKit,
  validateKitSelectionShape,
} from "@/lib/estoque/kits-domain";
import type { InventoryKitsPanelData } from "@/lib/estoque/kits-domain";
import { createInventoryKitInstance, deleteInventoryTagModelPermanently, InventoryKitServiceError, saveInventoryTagModel } from "@/lib/estoque/kits-service";

const idSchema = z.string().trim().min(1).max(100);
const EDITABLE_KIT_STATUSES = new Set(["RASCUNHO", "INCOMPLETO", "COMPLETO"]);

class InventoryKitError extends Error {}

function revalidateInventoryKits() {
  revalidatePath("/PainelAlpha/Estoque");
  revalidatePath("/PainelAlpha/PainelTarefas/painelTarefaSG/PainelEstoque");
}

function safeJson(value: unknown) {
  return JSON.stringify(value).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 20_000);
}

function actionError(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? fallback;
  if (error instanceof InventoryKitError) return error.message;
  if (error instanceof InventoryKitServiceError) return error.message;
  if (error instanceof InventoryDomainError) return error.message;
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return "Já existe um registro com esse nome ou código.";
  }
  return fallback;
}

async function actorSnapshot(userId: number) {
  const user = await db.usuarios.findFirst({ where: { id: userId, status: "ATIVO" }, select: { nome: true } });
  if (!user) throw new InventoryKitError("Usuário responsável não foi encontrado.");
  return user.nome;
}

async function writeAudit(
  tx: Prisma.TransactionClient,
  input: {
    entityType: string;
    entityId: string;
    action: string;
    actorUserId: number;
    actorName: string;
    oldData?: unknown;
    newData?: unknown;
    requestId: string;
  },
) {
  await tx.inventoryAuditLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorType: "USER",
      actorUserId: input.actorUserId,
      actorNameSnapshot: input.actorName,
      oldDataJson: input.oldData === undefined ? null : safeJson(input.oldData),
      newDataJson: input.newData === undefined ? null : safeJson(input.newData),
      requestId: input.requestId,
    },
  });
}

export async function carregarPainelKits(payload: unknown = {}) {
  try {
    await requireInventoryManager();
    const page = z.object({
      cursor: idSchema.optional(),
      tagLimit: z.coerce.number().int().min(1).max(50).default(24),
      productLimit: z.coerce.number().int().min(1).max(250).default(200),
      productQuery: z.string().trim().max(100).optional(),
    }).parse(payload);
    const [tags, products, collaborators, locations] = await Promise.all([
      db.inventoryTag.findMany({
        where: { archivedAt: null },
        include: {
          categoria: { select: { id: true, nome: true } },
          itemTags: { include: { produto: { select: { id: true, nome: true } } }, take: 200 },
          requirements: {
            include: { produto: { select: {
              id: true, nome: true, descricao: true, marca: true, modelo: true, imagem: true,
              quantidade: true, trackingMode: true, unidade: true,
              inventoryAssets: { where: { archivedAt: null }, select: { id: true, patrimonio: true, serial: true, codigoInterno: true, status: true }, take: 100 },
            } } },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            take: 100,
          },
          kitInstances: {
            where: { archivedAt: null },
            select: { id: true, code: true, status: true, requiredQuantityCache: true, fulfilledQuantityCache: true, version: true },
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
        orderBy: [{ nome: "asc" }, { id: "asc" }],
        take: page.tagLimit + 1,
        ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
      }),
      db.produtoEstoque.findMany({
        where: { archivedAt: null, ...(page.productQuery ? { nome: { contains: page.productQuery } } : {}) },
        select: {
          id: true,
          nome: true,
          descricao: true,
          marca: true,
          modelo: true,
          imagem: true,
          quantidade: true,
          trackingMode: true,
          unidade: true,
          inventoryAssets: {
            where: { archivedAt: null },
            select: { id: true, patrimonio: true, serial: true, codigoInterno: true, status: true },
            orderBy: [{ patrimonio: "asc" }, { serial: "asc" }],
            take: 100,
          },
        },
        orderBy: { nome: "asc" },
        take: page.productLimit,
      }),
      db.usuarios.findMany({ where: { status: "ATIVO" }, select: { id: true, nome: true }, orderBy: { nome: "asc" }, take: 250 }),
      db.inventoryLocation.findMany({ where: { ativo: true, archivedAt: null }, select: { id: true, nome: true }, orderBy: { nome: "asc" }, take: 250 }),
    ]);
    const hasMoreTags = tags.length > page.tagLimit;
    const visibleTags = hasMoreTags ? tags.slice(0, page.tagLimit) : tags;
    const data: InventoryKitsPanelData = {
      tags: visibleTags.map((tag) => ({
        ...tag,
        kind: tag.kind as "ETIQUETA" | "KIT_MODELO",
        requirements: tag.requirements.map(({ produto, ...requirement }) => ({ ...requirement, produto: { ...produto, assets: produto.inventoryAssets } })),
      })),
      products: products.map(({ inventoryAssets, ...product }) => ({ ...product, assets: inventoryAssets })),
      collaborators,
      locations,
      nextTagCursor: hasMoreTags ? visibleTags.at(-1)?.id ?? null : null,
    };
    return { success: true as const, data };
  } catch (error) {
    return { success: false as const, error: actionError(error, "Não foi possível carregar Tags e Kits.") };
  }
}

export async function salvarTagKit(payload: unknown) {
  try {
    const actor = await requireInventoryManager();
    const actorName = await actorSnapshot(actor.userId);
    const result = await saveInventoryTagModel(payload, { userId: actor.userId, name: actorName });
    revalidateInventoryKits();
    return { success: true as const, data: result };
  } catch (error) {
    return { success: false as const, error: actionError(error, "Não foi possível salvar a Tag/Kit.") };
  }
}

export async function arquivarTagKit(payload: unknown) {
  try {
    const actor = await requireInventoryManager();
    const actorName = await actorSnapshot(actor.userId);
    const data = z.object({ id: idSchema, version: z.coerce.number().int().positive() }).parse(payload);
    const requestId = crypto.randomUUID();
    await db.$transaction(async (tx) => {
      const activeInstances = await tx.inventoryKitInstance.count({
        where: { tagId: data.id, archivedAt: null, status: { in: [...INVENTORY_KIT_ACTIVE_STATUSES] } },
      });
      if (activeInstances > 0) throw new InventoryKitError("Arquive ou devolva as instâncias ativas antes de arquivar este modelo.");
      const result = await tx.inventoryTag.updateMany({
        where: { id: data.id, version: data.version, archivedAt: null },
        data: { ativo: false, archivedAt: new Date(), updatedById: actor.userId, version: { increment: 1 } },
      });
      if (result.count !== 1) throw new InventoryKitError("Tag/Kit não encontrada ou alterada por outra pessoa.");
      await writeAudit(tx, {
        entityType: "INVENTORY_TAG",
        entityId: data.id,
        action: "INVENTORY_TAG_ARCHIVED",
        actorUserId: actor.userId,
        actorName,
        newData: { ativo: false },
        requestId,
      });
    });
    revalidateInventoryKits();
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: actionError(error, "Não foi possível arquivar a Tag/Kit.") };
  }
}

export async function excluirTagKitDefinitivamente(payload: unknown) {
  try {
    const actor = await requireInventoryManager();
    const actorName = await actorSnapshot(actor.userId);
    const data = z.object({ id: idSchema, confirmation: z.literal("EXCLUIR") }).parse(payload);
    const result = await deleteInventoryTagModelPermanently(data.id, { userId: actor.userId, name: actorName });
    revalidateInventoryKits();
    return { success: true as const, data: result };
  } catch (error) {
    return { success: false as const, error: actionError(error, "Não foi possível excluir definitivamente a Tag/Kit.") };
  }
}

export async function criarInstanciaKit(payload: unknown) {
  try {
    const actor = await requireInventoryManager();
    const actorName = await actorSnapshot(actor.userId);
    const result = await createInventoryKitInstance(payload, { userId: actor.userId, name: actorName });
    revalidateInventoryKits();
    return { success: true as const, data: result };
  } catch (error) {
    return { success: false as const, error: actionError(error, "Não foi possível criar a instância do kit.") };
  }
}

export async function salvarComponentesKit(payload: unknown) {
  try {
    const actor = await requireInventoryManager();
    const actorName = await actorSnapshot(actor.userId);
    const data = saveInventoryKitComponentsSchema.parse(payload);
    const requestId = crypto.randomUUID();

    const result = await db.$transaction(async (tx) => {
      const kit = await tx.inventoryKitInstance.findUnique({
        where: { id: data.kitInstanceId },
        include: {
          tag: { include: { requirements: { include: { produto: { select: { id: true, nome: true, trackingMode: true, quantidade: true, archivedAt: true } } } } } },
          components: true,
          _count: { select: { movements: true, assignments: true } },
        },
      });
      if (!kit || kit.archivedAt) throw new InventoryKitError("Instância de kit não encontrada.");
      if (!EDITABLE_KIT_STATUSES.has(kit.status) || kit._count.movements > 0 || kit._count.assignments > 0) {
        throw new InventoryKitError("Este kit já possui entrega ou movimentação e sua composição não pode mais ser substituída.");
      }
      const requirements = new Map(kit.tag.requirements.map((requirement) => [requirement.id, requirement]));
      const selectionShape = validateKitSelectionShape(
        kit.tag.requirements.map((requirement) => ({
          id: requirement.id,
          produtoId: requirement.produtoId,
          productName: requirement.produto.nome,
          trackingMode: requirement.produto.trackingMode,
          quantityRequired: requirement.quantityRequired,
        })),
        data.components,
      );
      if (!selectionShape.valid) throw new InventoryKitError(selectionShape.error);
      const requestedAssetIds = new Set<string>();
      for (const component of data.components) {
        const requirement = requirements.get(component.requirementId);
        if (!requirement) throw new InventoryKitError("Um componente não corresponde aos requisitos atuais do modelo.");
        if (requirement.produto.archivedAt) throw new InventoryKitError(`${requirement.produto.nome} está arquivado.`);
        if (component.assetId) {
          requestedAssetIds.add(component.assetId);
        }
      }

      if (requestedAssetIds.size > 0) {
        const assets = await tx.inventoryAsset.findMany({
          where: { id: { in: [...requestedAssetIds] }, archivedAt: null },
          select: { id: true, produtoId: true, status: true },
        });
        if (assets.length !== requestedAssetIds.size) throw new InventoryKitError("Um ou mais patrimônios não existem ou estão arquivados.");
        const componentByAsset = new Map(data.components.filter((item) => item.assetId).map((item) => [item.assetId!, item]));
        for (const asset of assets) {
          const component = componentByAsset.get(asset.id)!;
          if (asset.produtoId !== component.produtoId) throw new InventoryKitError("O patrimônio selecionado pertence a outro item.");
          if (asset.status !== "DISPONIVEL") throw new InventoryKitError("Um patrimônio selecionado não está disponível.");
        }
        const allocatedAssets = await tx.inventoryKitComponent.findMany({
          where: {
            assetId: { in: [...requestedAssetIds] },
            kitInstanceId: { not: kit.id },
            status: { in: [...INVENTORY_KIT_COMPONENT_ACTIVE_STATUSES] },
            kitInstance: { archivedAt: null, status: { in: [...INVENTORY_KIT_ACTIVE_STATUSES] } },
          },
          select: { assetId: true },
        });
        if (allocatedAssets.length > 0) throw new InventoryKitError("Um patrimônio selecionado já pertence a outro kit ativo.");
      }

      const quantitativeComponents = data.components.filter((item) => !item.assetId);
      const requestedByProduct = new Map<string, number>();
      for (const component of quantitativeComponents) {
        requestedByProduct.set(component.produtoId, (requestedByProduct.get(component.produtoId) ?? 0) + component.quantity);
      }
      if (requestedByProduct.size > 0) {
        const allocated = await tx.inventoryKitComponent.groupBy({
          by: ["produtoId"],
          where: {
            produtoId: { in: [...requestedByProduct.keys()] },
            assetId: null,
            kitInstanceId: { not: kit.id },
            status: { in: [...INVENTORY_KIT_COMPONENT_ACTIVE_STATUSES] },
            kitInstance: { archivedAt: null, status: { in: [...INVENTORY_KIT_ACTIVE_STATUSES] } },
          },
          _sum: { quantity: true },
        });
        const allocatedByProduct = new Map(allocated.map((item) => [item.produtoId, item._sum.quantity ?? 0]));
        for (const [productId, requested] of requestedByProduct) {
          const product = kit.tag.requirements.find((item) => item.produtoId === productId)!.produto;
          const available = Math.max(0, product.quantidade - (allocatedByProduct.get(productId) ?? 0));
          if (requested > available) throw new InventoryKitError(`${product.nome} possui somente ${available} disponível(is) para kits.`);
        }
      }

      const validation = validateInventoryKit(
        kit.tag.requirements.map((requirement) => ({
          id: requirement.id,
          produtoId: requirement.produtoId,
          productName: requirement.produto.nome,
          quantityRequired: requirement.quantityRequired,
          required: requirement.required,
          sortOrder: requirement.sortOrder,
        })),
        data.components,
      );
      const updated = await tx.inventoryKitInstance.updateMany({
        where: { id: kit.id, version: data.version, archivedAt: null },
        data: {
          status: validation.complete ? "COMPLETO" : "INCOMPLETO",
          assembledAt: new Date(),
          completedAt: validation.complete ? new Date() : null,
          requiredQuantityCache: validation.requiredTotal,
          fulfilledQuantityCache: validation.requiredFulfilled,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new InventoryKitError("O kit foi alterado por outra pessoa. Recarregue antes de salvar.");
      await tx.inventoryKitComponent.deleteMany({ where: { kitInstanceId: kit.id } });
      if (data.components.length > 0) {
        await tx.inventoryKitComponent.createMany({
          data: data.components.map((component) => ({
            kitInstanceId: kit.id,
            requirementId: component.requirementId,
            produtoId: component.produtoId,
            assetId: component.assetId,
            quantity: component.quantity,
            status: "SELECIONADO",
            addedById: actor.userId,
          })),
        });
      }
      await writeAudit(tx, {
        entityType: "INVENTORY_KIT_INSTANCE",
        entityId: kit.id,
        action: "INVENTORY_KIT_COMPONENTS_VALIDATED",
        actorUserId: actor.userId,
        actorName,
        oldData: { version: kit.version, components: kit.components.map((item) => ({ produtoId: item.produtoId, assetId: item.assetId, quantity: item.quantity })) },
        newData: { version: kit.version + 1, status: validation.status, components: data.components, validation },
        requestId,
      });
      return { ...validation, version: kit.version + 1 };
    });

    revalidateInventoryKits();
    return { success: true as const, data: result };
  } catch (error) {
    return { success: false as const, error: actionError(error, "Não foi possível validar a composição do kit.") };
  }
}

export async function obterInstanciaKit(id: string) {
  try {
    await requireInventoryManager();
    const kitId = idSchema.parse(id);
    const kit = await db.inventoryKitInstance.findFirst({
      where: { id: kitId, archivedAt: null },
      include: {
        tag: {
          include: {
            requirements: {
              include: { produto: { select: { id: true, nome: true, trackingMode: true } } },
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            },
          },
        },
        components: {
          include: {
            asset: { select: { id: true, patrimonio: true, serial: true, codigoInterno: true } },
            produto: { select: { id: true, nome: true, usagePolicy: true } },
          },
          orderBy: { addedAt: "asc" },
        },
      },
    });
    if (!kit) return { success: false as const, error: "Instância de kit não encontrada." };
    const validation = validateInventoryKit(
      kit.tag.requirements.map((requirement) => ({
        id: requirement.id,
        produtoId: requirement.produtoId,
        productName: requirement.produto.nome,
        quantityRequired: requirement.quantityRequired,
        required: requirement.required,
        sortOrder: requirement.sortOrder,
      })),
      kit.components,
    );
    return { success: true as const, data: { kit, validation } };
  } catch (error) {
    return { success: false as const, error: actionError(error, "Não foi possível carregar a instância do kit.") };
  }
}

export async function entregarKit(payload: unknown) {
  try {
    const actor = await requireInventoryManager();
    const actorName = await actorSnapshot(actor.userId);
    const data = deliverInventoryKitSchema.parse(payload);
    const requestId = crypto.randomUUID();
    const result = await db.$transaction(async (tx) => {
      const kit = await tx.inventoryKitInstance.findUnique({
        where: { id: data.kitInstanceId },
        include: {
          tag: { select: { nome: true } },
          components: {
            include: {
              produto: { select: { usagePolicy: true, defaultLocationId: true } },
              asset: { select: { status: true } },
            },
          },
        },
      });
      if (!kit || kit.archivedAt) throw new InventoryKitError("Instância de kit não encontrada.");
      if (kit.status !== "COMPLETO" || kit.components.length === 0) throw new InventoryKitError("Somente um kit completo pode ser entregue.");
      if (kit.components.some((component) => component.status !== "SELECIONADO")) throw new InventoryKitError("O kit contém componentes que não estão disponíveis para entrega.");
      if (kit.components.some((component) => component.asset && component.asset.status !== "DISPONIVEL")) {
        throw new InventoryKitError("Um patrimônio do kit não está mais disponível. Revise a composição antes da entrega.");
      }

      const batchResults = await executeInventoryBatchInTransaction(tx, {
        idempotencyKey: data.idempotencyKey,
        requestId,
        actor: { actorType: "USER", actorUserId: actor.userId, actorName },
        kitInstanceId: kit.id,
        commands: kit.components.map((component) => component.produto.usagePolicy === "CONSUMIVEL"
          ? {
              kind: "STOCK_OUT" as const,
              kitComponentId: component.id,
              produtoId: component.produtoId,
              quantity: component.quantity,
              assetId: component.assetId ?? undefined,
              fromLocationId: component.produto.defaultLocationId ?? undefined,
              observacao: data.observacao || `Saída de consumível pelo kit ${kit.code}.`,
            }
          : {
              kind: "ASSIGN" as const,
              kitComponentId: component.id,
              produtoId: component.produtoId,
              quantity: component.quantity,
              assetId: component.assetId ?? undefined,
              fromLocationId: component.produto.defaultLocationId ?? undefined,
              toLocationId: data.locationId ?? undefined,
              responsibleUserId: data.responsibleUserId,
              observacao: data.observacao || `Entrega pelo kit ${kit.code}.`,
            }),
      });
      for (const component of kit.components) {
        await tx.inventoryKitComponent.update({
          where: { id: component.id },
          data: { status: component.produto.usagePolicy === "CONSUMIVEL" ? "CONSUMIDO" : "EM_USO" },
        });
      }
      const updated = await tx.inventoryKitInstance.updateMany({
        where: { id: kit.id, version: data.version, status: "COMPLETO", archivedAt: null },
        data: {
          status: "EM_USO",
          responsibleUserId: data.responsibleUserId,
          locationId: data.locationId,
          assignedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new InventoryKitError("O kit foi alterado por outra pessoa. Recarregue antes de entregar.");
      await writeAudit(tx, {
        entityType: "INVENTORY_KIT_INSTANCE",
        entityId: kit.id,
        action: "INVENTORY_KIT_DELIVERED",
        actorUserId: actor.userId,
        actorName,
        oldData: { status: kit.status, version: kit.version },
        newData: { status: "EM_USO", responsibleUserId: data.responsibleUserId, locationId: data.locationId, operations: batchResults.map((item) => item.operationId) },
        requestId,
      });
      return { id: kit.id, status: "EM_USO" as const, version: kit.version + 1 };
    });
    revalidateInventoryKits();
    return { success: true as const, data: result };
  } catch (error) {
    return { success: false as const, error: actionError(error, "Não foi possível iniciar a entrega do kit.") };
  }
}

export async function devolverKit(payload: unknown) {
  try {
    const actor = await requireInventoryReturnApprover();
    const actorName = await actorSnapshot(actor.userId);
    const data = returnInventoryKitSchema.parse(payload);
    const requestId = crypto.randomUUID();
    const result = await db.$transaction(async (tx) => {
      const kit = await tx.inventoryKitInstance.findUnique({
        where: { id: data.kitInstanceId },
        include: {
          components: {
            include: {
              produto: { select: { usagePolicy: true } },
              movements: { where: { assignmentId: { not: null } }, select: { assignmentId: true }, orderBy: { createdAt: "desc" }, take: 1 },
            },
          },
        },
      });
      if (!kit || kit.archivedAt) throw new InventoryKitError("Instância de kit não encontrada.");
      if (!["EM_USO", "DEVOLUCAO_PENDENTE"].includes(kit.status)) throw new InventoryKitError("Este kit não está em uso ou com devolução pendente.");
      const componentById = new Map(kit.components.map((component) => [component.id, component]));
      const commands = data.lines.map((line) => {
        const component = componentById.get(line.kitComponentId);
        if (!component) throw new InventoryKitError("Um componente não pertence ao kit informado.");
        if (component.produto.usagePolicy === "CONSUMIVEL") throw new InventoryKitError("Itens consumíveis não podem ser devolvidos ao estoque.");
        if (component.returnedQuantity + line.quantity > component.quantity) throw new InventoryKitError("A devolução excede a quantidade entregue de um componente.");
        const assignmentId = component.movements[0]?.assignmentId;
        if (!assignmentId) throw new InventoryKitError("A atribuição do componente não foi localizada.");
        return {
          kind: "RETURN" as const,
          kitComponentId: component.id,
          assignmentId,
          quantity: line.quantity,
          condition: line.condition,
          destinationLocationId: line.destinationLocationId ?? undefined,
          observacao: line.observacao ?? undefined,
        };
      });
      const batchResults = await executeInventoryBatchInTransaction(tx, {
        idempotencyKey: data.idempotencyKey,
        requestId,
        actor: { actorType: "USER", actorUserId: actor.userId, actorName },
        kitInstanceId: kit.id,
        commands,
      });
      const returnedByComponent = new Map(data.lines.map((line) => [line.kitComponentId, line]));
      for (const component of kit.components) {
        const line = returnedByComponent.get(component.id);
        if (!line) continue;
        const returnedQuantity = component.returnedQuantity + line.quantity;
        const fullyReturned = returnedQuantity === component.quantity;
        await tx.inventoryKitComponent.update({
          where: { id: component.id },
          data: {
            returnedQuantity,
            status: !fullyReturned
              ? "PARCIALMENTE_DEVOLVIDO"
              : ["COM_AVARIA", "DANIFICADO"].includes(line.condition) ? "DANIFICADO" : "DEVOLVIDO",
          },
        });
      }
      const nextStatus = kitStatusAfterReturn(kit.components.map((component) => ({
        usagePolicy: component.produto.usagePolicy,
        quantity: component.quantity,
        returnedQuantity: component.returnedQuantity + (returnedByComponent.get(component.id)?.quantity ?? 0),
      })));
      const allReturnablesReturned = nextStatus === "DEVOLVIDO";
      const updated = await tx.inventoryKitInstance.updateMany({
        where: { id: kit.id, version: data.version, status: kit.status, archivedAt: null },
        data: { status: nextStatus, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new InventoryKitError("O kit foi alterado por outra pessoa. Recarregue antes de devolver.");
      await writeAudit(tx, {
        entityType: "INVENTORY_KIT_INSTANCE",
        entityId: kit.id,
        action: allReturnablesReturned ? "INVENTORY_KIT_RETURNED" : "INVENTORY_KIT_PARTIALLY_RETURNED",
        actorUserId: actor.userId,
        actorName,
        oldData: { status: kit.status, version: kit.version },
        newData: { status: nextStatus, lines: data.lines, operations: batchResults.map((item) => item.operationId) },
        requestId,
      });
      return { id: kit.id, status: nextStatus, version: kit.version + 1 };
    });
    revalidateInventoryKits();
    return { success: true as const, data: result };
  } catch (error) {
    return { success: false as const, error: actionError(error, "Não foi possível iniciar a devolução do kit.") };
  }
}
