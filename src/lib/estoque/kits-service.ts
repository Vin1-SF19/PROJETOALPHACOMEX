import "server-only";

import { Prisma, type PrismaClient } from "@prisma/client";
import db from "@/lib/prisma";
import {
  createInventoryKitSchema,
  inventoryKitCode,
  normalizeInventoryTagName,
  saveInventoryTagSchema,
  validateInventoryKit,
} from "@/lib/estoque/kits-domain";

export interface InventoryKitServiceActor {
  userId: number;
  name: string;
}

export class InventoryKitServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryKitServiceError";
  }
}

function safeJson(value: unknown) {
  return JSON.stringify(value).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 20_000);
}

function canonicalComposition(input: {
  kind: string;
  produtoIds?: readonly string[];
  requirements?: ReadonlyArray<{ produtoId: string; quantityRequired: number; required: boolean; sortOrder: number; observacao?: string | null }>;
}) {
  if (input.kind === "ETIQUETA") return [...(input.produtoIds ?? [])].sort();
  return [...(input.requirements ?? [])]
    .map((requirement) => ({
      produtoId: requirement.produtoId,
      quantityRequired: requirement.quantityRequired,
      required: requirement.required,
      sortOrder: requirement.sortOrder,
      observacao: requirement.observacao || null,
    }))
    .sort((left, right) => left.produtoId.localeCompare(right.produtoId));
}

async function audit(tx: Prisma.TransactionClient, input: {
  entityType: string;
  entityId: string;
  action: string;
  actor: InventoryKitServiceActor;
  oldData?: unknown;
  newData?: unknown;
  requestId: string;
}) {
  await tx.inventoryAuditLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actorType: "USER",
      actorUserId: input.actor.userId,
      actorNameSnapshot: input.actor.name,
      oldDataJson: input.oldData === undefined ? null : safeJson(input.oldData),
      newDataJson: input.newData === undefined ? null : safeJson(input.newData),
      requestId: input.requestId,
    },
  });
}

/** Serviço de aplicação compartilhado por Server Actions e CLI; não resolve sessão. */
export async function saveInventoryTagModel(
  payload: unknown,
  actor: InventoryKitServiceActor,
  client: PrismaClient = db,
) {
  const data = saveInventoryTagSchema.parse(payload);
  const normalizedName = normalizeInventoryTagName(data.nome);
  const referencedProductIds = data.kind === "KIT_MODELO"
    ? data.requirements.map((requirement) => requirement.produtoId)
    : data.produtoIds;
  const requestId = crypto.randomUUID();

  return client.$transaction(async (tx) => {
    if (data.categoriaId) {
      const category = await tx.categoria.findFirst({ where: { id: data.categoriaId, ativo: true, archivedAt: null }, select: { id: true } });
      if (!category) throw new InventoryKitServiceError("Categoria não encontrada ou inativa.");
    }
    if (referencedProductIds.length > 0) {
      const productCount = await tx.produtoEstoque.count({ where: { id: { in: referencedProductIds }, archivedAt: null } });
      if (productCount !== referencedProductIds.length) throw new InventoryKitServiceError("Um ou mais itens da composição não existem ou estão arquivados.");
    }
    const previous = data.id
      ? await tx.inventoryTag.findUnique({ where: { id: data.id }, include: { itemTags: true, requirements: true, _count: { select: { kitInstances: true } } } })
      : null;
    if (data.id && (!previous || previous.archivedAt)) throw new InventoryKitServiceError("Tag ou modelo não encontrado.");

    if (previous?._count.kitInstances) {
      const before = canonicalComposition({ kind: previous.kind, produtoIds: previous.itemTags.map((item) => item.produtoId), requirements: previous.requirements });
      const after = canonicalComposition(data);
      if (previous.kind !== data.kind || JSON.stringify(before) !== JSON.stringify(after)) {
        throw new InventoryKitServiceError("A composição não pode ser alterada após a criação de instâncias. Edite apenas os dados visuais do modelo.");
      }
    }

    let id: string;
    if (previous) {
      if (!data.version) throw new InventoryKitServiceError("Versão da Tag/Kit é obrigatória para edição.");
      const updated = await tx.inventoryTag.updateMany({
        where: { id: previous.id, version: data.version, archivedAt: null },
        data: {
          kind: data.kind, nome: data.nome, normalizedName, descricao: data.descricao || null,
          cor: data.cor, icone: data.icone || null, categoriaId: data.categoriaId,
          updatedById: actor.userId, version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new InventoryKitServiceError("A Tag/Kit foi alterada por outra pessoa. Recarregue antes de salvar.");
      id = previous.id;
      if (!previous._count.kitInstances) {
        await tx.inventoryItemTag.deleteMany({ where: { tagId: id } });
        await tx.inventoryTagRequirement.deleteMany({ where: { tagId: id } });
      }
    } else {
      const created = await tx.inventoryTag.create({ data: {
        kind: data.kind, nome: data.nome, normalizedName, descricao: data.descricao || null,
        cor: data.cor, icone: data.icone || null, categoriaId: data.categoriaId,
        createdById: actor.userId, updatedById: actor.userId,
      } });
      id = created.id;
    }

    if (!previous?._count.kitInstances) {
      if (data.kind === "ETIQUETA" && data.produtoIds.length > 0) {
        await tx.inventoryItemTag.createMany({ data: data.produtoIds.map((produtoId) => ({ tagId: id, produtoId, createdById: actor.userId })) });
      }
      if (data.kind === "KIT_MODELO" && data.requirements.length > 0) {
        await tx.inventoryTagRequirement.createMany({ data: data.requirements.map((requirement) => ({
          tagId: id, produtoId: requirement.produtoId, quantityRequired: requirement.quantityRequired,
          required: requirement.required, sortOrder: requirement.sortOrder, observacao: requirement.observacao || null,
        })) });
      }
    }
    await audit(tx, {
      entityType: "INVENTORY_TAG", entityId: id,
      action: previous ? "INVENTORY_TAG_UPDATED" : "INVENTORY_TAG_CREATED",
      actor, oldData: previous && { kind: previous.kind, nome: previous.nome, version: previous.version },
      newData: { kind: data.kind, nome: data.nome, composition: canonicalComposition(data) }, requestId,
    });
    return { id };
  });
}

/** Exclui o modelo e instâncias ainda sem histórico; entregas/movimentos tornam a exclusão proibida. */
export async function deleteInventoryTagModelPermanently(
  tagId: string,
  actor: InventoryKitServiceActor,
  client: PrismaClient = db,
) {
  const id = typeof tagId === "string" ? tagId.trim() : "";
  if (!id || id.length > 100) throw new InventoryKitServiceError("Tag/Kit inválida.");
  return client.$transaction(async (tx) => {
    const tag = await tx.inventoryTag.findUnique({
      where: { id },
      include: { kitInstances: { select: { id: true, code: true } } },
    });
    if (!tag) throw new InventoryKitServiceError("Tag/Kit não encontrada.");
    const instanceIds = tag.kitInstances.map((instance) => instance.id);
    const [movements, assignments] = instanceIds.length
      ? await Promise.all([
          tx.inventoryMovement.count({ where: { kitInstanceId: { in: instanceIds } } }),
          tx.inventoryAssignment.count({ where: { kitInstanceId: { in: instanceIds } } }),
        ])
      : [0, 0];
    if (movements || assignments) {
      throw new InventoryKitServiceError("Este Kit possui entrega, devolução ou movimentação registrada e não pode ser excluído definitivamente. Use Arquivar.");
    }

    await audit(tx, {
      entityType: "INVENTORY_TAG",
      entityId: id,
      action: "INVENTORY_TAG_DELETED_PERMANENTLY",
      actor,
      oldData: { kind: tag.kind, nome: tag.nome, instances: tag.kitInstances },
      newData: null,
      requestId: crypto.randomUUID(),
    });
    if (instanceIds.length) await tx.inventoryKitComponent.deleteMany({ where: { kitInstanceId: { in: instanceIds } } });
    await tx.inventoryKitInstance.deleteMany({ where: { tagId: id } });
    await tx.inventoryItemTag.deleteMany({ where: { tagId: id } });
    await tx.inventoryTagRequirement.deleteMany({ where: { tagId: id } });
    await tx.inventoryTag.delete({ where: { id } });
    return { id, deleted: true as const, deletedInstances: instanceIds.length };
  });
}

/** Cria uma instância vazia; a seleção/validação posterior usa o mesmo domínio da UI. */
export async function createInventoryKitInstance(
  payload: unknown,
  actor: InventoryKitServiceActor,
  client: PrismaClient = db,
) {
  const data = createInventoryKitSchema.parse(payload);
  const requestId = crypto.randomUUID();
  return client.$transaction(async (tx) => {
    const tag = await tx.inventoryTag.findFirst({
      where: { id: data.tagId, kind: "KIT_MODELO", ativo: true, archivedAt: null },
      include: { requirements: { select: { quantityRequired: true, required: true } } },
    });
    if (!tag) throw new InventoryKitServiceError("Modelo de kit não encontrado ou inativo.");
    const requiredQuantity = tag.requirements.filter((item) => item.required).reduce((total, item) => total + item.quantityRequired, 0);
    if (requiredQuantity === 0) throw new InventoryKitServiceError("Adicione ao menos um requisito obrigatório antes de montar o kit.");
    const created = await tx.inventoryKitInstance.create({ data: {
      tagId: tag.id, code: data.code || inventoryKitCode(tag.nome), status: "RASCUNHO",
      assembledById: actor.userId, requiredQuantityCache: requiredQuantity, observacao: data.observacao || null,
    } });
    await audit(tx, {
      entityType: "INVENTORY_KIT_INSTANCE", entityId: created.id, action: "INVENTORY_KIT_INSTANCE_CREATED",
      actor, newData: { tagId: tag.id, code: created.code, status: created.status }, requestId,
    });
    return { id: created.id, code: created.code, version: created.version };
  });
}

/** Validação read-only reutilizável pelo CLI e por jobs, sem autenticação implícita. */
export async function validatePersistedInventoryKit(kitId: string, client: PrismaClient = db) {
  const kit = await client.inventoryKitInstance.findFirst({
    where: { id: kitId, archivedAt: null },
    include: {
      tag: { include: { requirements: { include: { produto: { select: { nome: true } } } } } },
      components: true,
    },
  });
  if (!kit) throw new InventoryKitServiceError("Instância de kit não encontrada.");
  return {
    kit: { id: kit.id, code: kit.code, status: kit.status, version: kit.version },
    validation: validateInventoryKit(
      kit.tag.requirements.map((requirement) => ({
        id: requirement.id, produtoId: requirement.produtoId, productName: requirement.produto.nome,
        quantityRequired: requirement.quantityRequired, required: requirement.required, sortOrder: requirement.sortOrder,
      })),
      kit.components,
    ),
  };
}
