import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import db from "@/lib/prisma";
import {
  emptyBucketTotals,
  inventoryStatusFromTotals,
  InventoryDomainError,
  returnDestination,
  transitionForMovement,
  type InventoryBucket,
  type InventoryBucketTotals,
} from "@/lib/estoque/movement-domain";
import {
  assignInventoryCommandSchema,
  inventoryBatchSchema,
  registerInventoryAssetCommandSchema,
  returnInventoryCommandSchema,
  returnMaintenanceCommandSchema,
  sendMaintenanceCommandSchema,
  stockMovementCommandSchema,
  type AssignInventoryCommand,
  type InventoryBatchInput,
  type RegisterInventoryAssetCommand,
  type ReturnInventoryCommand,
  type ReturnMaintenanceCommand,
  type SendMaintenanceCommand,
  type StockMovementCommand,
} from "@/lib/estoque/movement-schemas";

type InventoryDb = PrismaClient;
type InventoryTx = Prisma.TransactionClient;

export interface InventoryOperationResult {
  operationId: string;
  produtoId: string;
  movementId?: string;
  assignmentId?: string;
  maintenanceId?: string;
  assetId?: string;
  idempotentReplay: boolean;
  availableAfter: number;
  totalAfter: number;
}

export interface InventoryBatchCommandResult {
  kitComponentId: string;
  operationId: string;
  movementId: string;
  assignmentId?: string;
  idempotentReplay: boolean;
}

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function inventoryRequestHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function safeJson(value: unknown): string {
  return JSON.stringify(canonicalize(value)).replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 8_000);
}

async function operationReplay(
  client: InventoryDb | InventoryTx,
  idempotencyKey: string,
  requestHash: string,
): Promise<InventoryOperationResult | null> {
  const operation = await client.inventoryOperation.findUnique({
    where: { idempotencyKey },
    include: { movements: { orderBy: { createdAt: "asc" }, take: 1 }, assignments: { take: 1 }, maintenanceSends: { take: 1 }, maintenanceReturns: { take: 1 } },
  });
  if (!operation) return null;
  if (operation.requestHash !== requestHash) {
    throw new InventoryDomainError("IDEMPOTENCY_CONFLICT", "A chave de idempotência já foi usada com dados diferentes.");
  }
  const movement = operation.movements[0];
  return {
    operationId: operation.id,
    produtoId: movement?.produtoId ?? operation.assignments[0]?.produtoId ?? operation.maintenanceSends[0]?.produtoId ?? operation.maintenanceReturns[0]?.produtoId ?? "",
    movementId: movement?.id,
    assignmentId: operation.assignments[0]?.id ?? movement?.assignmentId ?? undefined,
    maintenanceId: operation.maintenanceSends[0]?.id ?? operation.maintenanceReturns[0]?.id,
    assetId: movement?.assetId ?? undefined,
    idempotentReplay: true,
    availableAfter: movement?.availableAfter ?? 0,
    totalAfter: movement?.totalAfter ?? 0,
  };
}

async function totalsForProduct(tx: InventoryTx, produtoId: string): Promise<InventoryBucketTotals> {
  const rows = await tx.inventoryStockBalance.groupBy({
    by: ["bucket"],
    where: { produtoId },
    _sum: { quantity: true },
  });
  const totals = emptyBucketTotals();
  for (const row of rows) {
    if (row.bucket in totals) totals[row.bucket as InventoryBucket] = row._sum.quantity ?? 0;
  }
  return totals;
}

function totalQuantity(totals: InventoryBucketTotals): number {
  return Object.values(totals).reduce((sum, quantity) => sum + quantity, 0);
}

async function assertLocation(tx: InventoryTx, locationId: string | undefined): Promise<void> {
  if (!locationId) return;
  const exists = await tx.inventoryLocation.findFirst({ where: { id: locationId, ativo: true, archivedAt: null }, select: { id: true } });
  if (!exists) throw new InventoryDomainError("LOCATION_NOT_FOUND", "Localização inexistente ou inativa.");
}

async function getProduct(tx: InventoryTx, produtoId: string) {
  const product = await tx.produtoEstoque.findFirst({ where: { id: produtoId, archivedAt: null } });
  if (!product) throw new InventoryDomainError("ITEM_NOT_FOUND", "Item de estoque não encontrado ou arquivado.");
  return product;
}

async function validateAsset(tx: InventoryTx, product: { id: string; trackingMode: string }, assetId: string | undefined, quantity: number) {
  if (product.trackingMode === "INDIVIDUAL") {
    if (!assetId || quantity !== 1) throw new InventoryDomainError("ASSET_REQUIRED", "Item individual exige uma unidade patrimonial e quantidade 1.");
    const asset = await tx.inventoryAsset.findFirst({ where: { id: assetId, produtoId: product.id, archivedAt: null } });
    if (!asset) throw new InventoryDomainError("ASSET_NOT_FOUND", "Unidade patrimonial não encontrada para este item.");
    return asset;
  }
  if (assetId) throw new InventoryDomainError("ASSET_NOT_ALLOWED", "Item por quantidade não aceita unidade patrimonial.");
  return null;
}

function assertAssetSource(
  asset: { status: string; currentLocationId: string | null } | null,
  bucket: InventoryBucket | null,
  locationId?: string,
) {
  if (!asset) return;
  if (!bucket) throw new InventoryDomainError("INDIVIDUAL_ENTRY_REQUIRES_REGISTRATION", "Use o cadastro de unidade patrimonial para dar entrada em item individual.");
  const expectedStatus: Partial<Record<InventoryBucket, string>> = {
    DISPONIVEL: "DISPONIVEL", EM_USO: "EM_USO", MANUTENCAO: "EM_MANUTENCAO", DANIFICADO: "DANIFICADO", RESERVADO: "RESERVADO",
  };
  if (asset.status !== expectedStatus[bucket]) throw new InventoryDomainError("ASSET_STATUS_CONFLICT", "A unidade patrimonial não está no estado exigido pela movimentação.");
  if (locationId && asset.currentLocationId !== locationId) throw new InventoryDomainError("ASSET_LOCATION_CONFLICT", "A unidade patrimonial não está na localização de origem informada.");
}

async function findBalance(tx: InventoryTx, produtoId: string, locationId: string | undefined, bucket: InventoryBucket) {
  return tx.inventoryStockBalance.findFirst({ where: { produtoId, locationId: locationId ?? null, bucket } });
}

async function addBalance(tx: InventoryTx, produtoId: string, locationId: string | undefined, bucket: InventoryBucket, quantity: number) {
  let balance = await findBalance(tx, produtoId, locationId, bucket);
  if (!balance) {
    try {
      balance = await tx.inventoryStockBalance.create({
        data: { id: randomUUID(), produtoId, locationId: locationId ?? null, bucket, quantity: 0, version: 1 },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      balance = await findBalance(tx, produtoId, locationId, bucket);
      if (!balance) throw error;
    }
  }
  const updated = await tx.inventoryStockBalance.updateMany({
    where: { id: balance.id, version: balance.version },
    data: { quantity: { increment: quantity }, version: { increment: 1 } },
  });
  if (updated.count !== 1) throw new InventoryDomainError("CONCURRENT_UPDATE", "O saldo foi alterado por outra operação. Tente novamente.");
}

async function subtractBalance(tx: InventoryTx, produtoId: string, locationId: string | undefined, bucket: InventoryBucket, quantity: number) {
  const balance = await findBalance(tx, produtoId, locationId, bucket);
  if (!balance || balance.quantity < quantity) throw new InventoryDomainError("INSUFFICIENT_STOCK", "Saldo insuficiente para concluir a operação.");
  const updated = await tx.inventoryStockBalance.updateMany({
    where: { id: balance.id, version: balance.version, quantity: { gte: quantity } },
    data: { quantity: { decrement: quantity }, version: { increment: 1 } },
  });
  if (updated.count !== 1) throw new InventoryDomainError("CONCURRENT_UPDATE", "O saldo foi alterado por outra operação. Tente novamente.");
}

async function applyTransition(tx: InventoryTx, input: {
  produtoId: string;
  quantity: number;
  fromBucket: InventoryBucket | null;
  toBucket: InventoryBucket | null;
  fromLocationId?: string;
  toLocationId?: string;
}) {
  if (input.fromBucket) await subtractBalance(tx, input.produtoId, input.fromLocationId, input.fromBucket, input.quantity);
  if (input.toBucket) await addBalance(tx, input.produtoId, input.toLocationId, input.toBucket, input.quantity);
}

async function syncProductCache(tx: InventoryTx, produtoId: string) {
  const totals = await totalsForProduct(tx, produtoId);
  const total = totalQuantity(totals);
  const product = await tx.produtoEstoque.update({
    where: { id: produtoId },
    data: {
      quantidade: totals.DISPONIVEL,
      quantidadeEmUso: totals.EM_USO,
      quantidadeReservada: totals.RESERVADO,
      quantidadeManutencao: totals.MANUTENCAO,
      quantidadeDanificada: totals.DANIFICADO,
      quantidadeTotal: total,
      status: inventoryStatusFromTotals(totals),
      version: { increment: 1 },
    },
  });
  if (totals.DISPONIVEL <= product.estoqueMinimo) {
    await tx.listaCompra.upsert({
      where: { produtoId },
      update: { nome: product.nome, quantidadeAtual: totals.DISPONIVEL, minimoEsperado: product.estoqueMinimo, unidade: product.unidade, categoriaId: product.categoriaId },
      create: { produtoId, nome: product.nome, quantidadeAtual: totals.DISPONIVEL, minimoEsperado: product.estoqueMinimo, unidade: product.unidade, status: "PENDENTE", categoriaId: product.categoriaId },
    });
  } else {
    // Um item adicionado manualmente ao carrinho continua sendo uma intenção do usuário.
    // Somente o alerta automático PENDENTE deixa de existir quando o saldo é normalizado.
    await tx.listaCompra.deleteMany({ where: { produtoId, status: "PENDENTE" } });
  }
  return { totals, available: totals.DISPONIVEL, total };
}

async function createOperation(tx: InventoryTx, input: {
  idempotencyKey: string;
  requestHash: string;
  type: string;
  actor: { actorType: "USER" | "SYSTEM"; actorUserId?: number; actorName: string };
  occurredAt?: Date;
  observacao?: string;
  metadata?: unknown;
}) {
  return tx.inventoryOperation.create({
    data: {
      id: randomUUID(),
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      type: input.type,
      actorType: input.actor.actorType,
      actorUserId: input.actor.actorUserId ?? null,
      actorNameSnapshot: input.actor.actorName,
      occurredAt: input.occurredAt ?? new Date(),
      observacao: input.observacao,
      metadataJson: input.metadata ? safeJson(input.metadata) : null,
    },
  });
}

async function createAudit(tx: InventoryTx, input: {
  entityType: string;
  entityId: string;
  action: string;
  operationId: string;
  actor: { actorType: string; actorUserId?: number; actorName: string };
  oldData: unknown;
  newData: unknown;
  requestId?: string;
}) {
  await tx.inventoryAuditLog.create({
    data: {
      id: randomUUID(), entityType: input.entityType, entityId: input.entityId, action: input.action,
      operationId: input.operationId, actorType: input.actor.actorType, actorUserId: input.actor.actorUserId ?? null,
      actorNameSnapshot: input.actor.actorName, oldDataJson: safeJson(input.oldData), newDataJson: safeJson(input.newData), requestId: input.requestId,
    },
  });
}

async function createMaintenanceFromReturn(tx: InventoryTx, input: {
  operationId: string;
  produtoId: string;
  assetId?: string | null;
  quantity: number;
  actorUserId: number;
  sentAt: Date;
  observacao?: string;
}) {
  return tx.inventoryMaintenance.create({
    data: {
      id: randomUUID(),
      produtoId: input.produtoId,
      assetId: input.assetId ?? null,
      quantity: input.quantity,
      reason: "Devolução classificada como necessita manutenção",
      sentAt: input.sentAt,
      observacao: input.observacao,
      openedById: input.actorUserId,
      sendOperationId: input.operationId,
    },
  });
}

async function runIdempotent(
  client: InventoryDb,
  idempotencyKey: string,
  requestHash: string,
  work: (tx: InventoryTx) => Promise<InventoryOperationResult>,
): Promise<InventoryOperationResult> {
  const replay = await operationReplay(client, idempotencyKey, requestHash);
  if (replay) return replay;
  try {
    return await client.$transaction(work);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const concurrentReplay = await operationReplay(client, idempotencyKey, requestHash);
      if (concurrentReplay) return concurrentReplay;
    }
    throw error;
  }
}

async function executeStockMovementWithClient(client: InventoryDb, raw: StockMovementCommand, options?: { completePurchase?: boolean }) {
  const command = stockMovementCommandSchema.parse(raw);
  const requestHash = inventoryRequestHash({ command, completePurchase: options?.completePurchase ?? false });
  return runIdempotent(client, command.idempotencyKey, requestHash, async (tx) => {
    const product = await getProduct(tx, command.produtoId);
    const asset = await validateAsset(tx, product, command.assetId, command.quantity);
    await assertLocation(tx, command.fromLocationId);
    await assertLocation(tx, command.toLocationId);
    const transition = transitionForMovement(command);
    assertAssetSource(asset, transition.fromBucket, command.fromLocationId);
    const before = await totalsForProduct(tx, command.produtoId);
    const operation = await createOperation(tx, { ...command, requestHash, metadata: command.metadata });
    const transitionTargetLocation = transition.toBucket && transition.fromBucket
      ? (command.toLocationId ?? command.fromLocationId)
      : command.toLocationId;
    await applyTransition(tx, { ...command, ...transition, toLocationId: transitionTargetLocation });
    const cache = await syncProductCache(tx, command.produtoId);
    if (options?.completePurchase) {
      await tx.listaCompra.deleteMany({ where: { produtoId: command.produtoId, status: "PENDENTE" } });
    }
    const movement = await tx.inventoryMovement.create({
      data: {
        id: randomUUID(), operationId: operation.id, produtoId: command.produtoId, assetId: command.assetId,
        quantity: command.quantity, fromLocationId: command.fromLocationId, toLocationId: transitionTargetLocation,
        fromBucket: transition.fromBucket, toBucket: transition.toBucket,
        availableBefore: before.DISPONIVEL, availableAfter: cache.available,
        totalBefore: totalQuantity(before), totalAfter: cache.total,
      },
    });
    if (asset) {
      const statusByBucket: Record<InventoryBucket, string> = {
        DISPONIVEL: "DISPONIVEL", RESERVADO: "RESERVADO", EM_USO: "EM_USO", MANUTENCAO: "EM_MANUTENCAO", DANIFICADO: "DANIFICADO",
      };
      const status = transition.toBucket === null
        ? (command.type === "PERDA" ? "EXTRAVIADO" : "BAIXADO")
        : statusByBucket[transition.toBucket];
      await tx.inventoryAsset.update({ where: { id: asset.id }, data: { status, currentLocationId: transitionTargetLocation ?? null, updatedById: command.actor.actorUserId, version: { increment: 1 } } });
    }
    await createAudit(tx, {
      entityType: "ProdutoEstoque", entityId: command.produtoId, action: command.type, operationId: operation.id,
      actor: command.actor, oldData: before, newData: cache.totals, requestId: command.requestId,
    });
    return { operationId: operation.id, produtoId: command.produtoId, movementId: movement.id, assetId: command.assetId, idempotentReplay: false, availableAfter: cache.available, totalAfter: cache.total };
  });
}

export async function executeStockMovement(raw: StockMovementCommand, client: InventoryDb = db) {
  return executeStockMovementWithClient(client, raw);
}

export async function recordInventoryPurchase(raw: Omit<StockMovementCommand, "type">, client: InventoryDb = db) {
  return executeStockMovementWithClient(client, { ...raw, type: "ENTRADA" }, { completePurchase: true });
}

export async function assignInventory(raw: AssignInventoryCommand, client: InventoryDb = db) {
  const command = assignInventoryCommandSchema.parse(raw);
  const requestHash = inventoryRequestHash(command);
  return runIdempotent(client, command.idempotencyKey, requestHash, async (tx) => {
    const product = await getProduct(tx, command.produtoId);
    if (product.usagePolicy === "CONSUMIVEL") {
      throw new InventoryDomainError("CONSUMABLE_NOT_ASSIGNABLE", "Item consumível deve gerar SAÍDA e não pode ser marcado como EM_USO.");
    }
    const asset = await validateAsset(tx, product, command.assetId, command.quantity);
    assertAssetSource(asset, "DISPONIVEL", command.fromLocationId);
    const responsible = await tx.usuarios.findFirst({ where: { id: command.responsibleUserId, status: "ATIVO" }, select: { id: true } });
    if (!responsible) throw new InventoryDomainError("RESPONSIBLE_NOT_FOUND", "Colaborador responsável inexistente ou inativo.");
    await assertLocation(tx, command.fromLocationId);
    await assertLocation(tx, command.toLocationId);
    const before = await totalsForProduct(tx, command.produtoId);
    const operation = await createOperation(tx, { ...command, requestHash, type: "EM_USO", metadata: command.metadata });
    const assignment = await tx.inventoryAssignment.create({
      data: {
        id: randomUUID(), produtoId: command.produtoId, assetId: command.assetId, responsibleUserId: command.responsibleUserId,
        sectorId: command.sectorId, locationId: command.toLocationId, quantity: command.quantity,
        deliveredAt: command.occurredAt ?? new Date(), expectedReturnAt: command.expectedReturnAt,
        observacao: command.observacao, handedById: command.actor.actorUserId!, operationId: operation.id,
      },
    });
    await applyTransition(tx, { produtoId: command.produtoId, quantity: command.quantity, fromBucket: "DISPONIVEL", toBucket: "EM_USO", fromLocationId: command.fromLocationId, toLocationId: command.toLocationId });
    const cache = await syncProductCache(tx, command.produtoId);
    const movement = await tx.inventoryMovement.create({ data: {
      id: randomUUID(), operationId: operation.id, produtoId: command.produtoId, assetId: command.assetId,
      assignmentId: assignment.id, quantity: command.quantity, fromLocationId: command.fromLocationId, toLocationId: command.toLocationId,
      fromBucket: "DISPONIVEL", toBucket: "EM_USO", availableBefore: before.DISPONIVEL, availableAfter: cache.available,
      totalBefore: totalQuantity(before), totalAfter: cache.total,
    } });
    if (asset) await tx.inventoryAsset.update({ where: { id: asset.id }, data: { status: "EM_USO", currentLocationId: command.toLocationId ?? null, updatedById: command.actor.actorUserId, version: { increment: 1 } } });
    await createAudit(tx, { entityType: "InventoryAssignment", entityId: assignment.id, action: "EM_USO", operationId: operation.id, actor: command.actor, oldData: null, newData: assignment, requestId: command.requestId });
    return { operationId: operation.id, produtoId: command.produtoId, movementId: movement.id, assignmentId: assignment.id, assetId: command.assetId, idempotentReplay: false, availableAfter: cache.available, totalAfter: cache.total };
  });
}

export async function returnInventory(raw: ReturnInventoryCommand, client: InventoryDb = db) {
  const command = returnInventoryCommandSchema.parse(raw);
  const actorUserId = command.actor.actorUserId;
  if (!actorUserId) throw new InventoryDomainError("USER_ACTOR_REQUIRED", "A devolução exige um usuário responsável.");
  const requestHash = inventoryRequestHash(command);
  return runIdempotent(client, command.idempotencyKey, requestHash, async (tx) => {
    const assignment = await tx.inventoryAssignment.findUnique({ where: { id: command.assignmentId } });
    if (!assignment?.produtoId || !["ATIVA", "PARCIALMENTE_DEVOLVIDA"].includes(assignment.status)) throw new InventoryDomainError("ASSIGNMENT_NOT_ACTIVE", "Atribuição não encontrada ou já encerrada.");
    if (assignment.returnedQuantity + command.quantity > assignment.quantity) throw new InventoryDomainError("RETURN_EXCEEDS_ASSIGNMENT", "A devolução excede a quantidade entregue.");
    await assertLocation(tx, command.destinationLocationId);
    const destinationBucket = returnDestination(command.condition);
    const before = await totalsForProduct(tx, assignment.produtoId);
    const returnedAt = command.returnedAt ?? new Date();
    const operation = await createOperation(tx, {
      ...command,
      requestHash,
      type: "DEVOLUCAO",
      occurredAt: returnedAt,
      metadata: command.condition === "NECESSITA_MANUTENCAO" ? { sourceLocationId: command.destinationLocationId ?? assignment.locationId ?? null } : undefined,
    });
    const returnedQuantity = assignment.returnedQuantity + command.quantity;
    const closed = returnedQuantity === assignment.quantity;
    const assignmentUpdate = await tx.inventoryAssignment.updateMany({
      where: { id: assignment.id, version: assignment.version, returnedQuantity: assignment.returnedQuantity, status: assignment.status },
      data: { returnedQuantity, status: closed ? "DEVOLVIDA" : "PARCIALMENTE_DEVOLVIDA", closedAt: closed ? returnedAt : null, version: { increment: 1 } },
    });
    if (assignmentUpdate.count !== 1) throw new InventoryDomainError("CONCURRENT_RETURN", "A atribuição recebeu outra devolução simultânea. Recarregue e tente novamente.");
    const batch = await tx.inventoryReturnBatch.create({ data: { id: randomUUID(), assignmentId: assignment.id, operationId: operation.id, receivedById: actorUserId, returnedAt, observacao: command.observacao } });
    await tx.inventoryReturnLine.create({ data: { id: randomUUID(), batchId: batch.id, produtoId: assignment.produtoId, assetId: assignment.assetId, quantity: command.quantity, condition: command.condition, destinationLocationId: command.destinationLocationId, observacao: command.observacao } });
    const destinationLocationId = command.destinationLocationId ?? assignment.locationId ?? undefined;
    const maintenance = command.condition === "NECESSITA_MANUTENCAO"
      ? await createMaintenanceFromReturn(tx, { operationId: operation.id, produtoId: assignment.produtoId, assetId: assignment.assetId, quantity: command.quantity, actorUserId, sentAt: returnedAt, observacao: command.observacao })
      : null;
    await applyTransition(tx, { produtoId: assignment.produtoId, quantity: command.quantity, fromBucket: "EM_USO", toBucket: destinationBucket, fromLocationId: assignment.locationId ?? undefined, toLocationId: destinationLocationId });
    const cache = await syncProductCache(tx, assignment.produtoId);
    const movement = await tx.inventoryMovement.create({ data: {
      id: randomUUID(), operationId: operation.id, produtoId: assignment.produtoId, assetId: assignment.assetId,
      assignmentId: assignment.id, maintenanceId: maintenance?.id, quantity: command.quantity, fromLocationId: assignment.locationId, toLocationId: destinationLocationId,
      fromBucket: "EM_USO", toBucket: destinationBucket, availableBefore: before.DISPONIVEL, availableAfter: cache.available,
      totalBefore: totalQuantity(before), totalAfter: cache.total,
    } });
    if (assignment.assetId) await tx.inventoryAsset.update({ where: { id: assignment.assetId }, data: { status: destinationBucket === "DISPONIVEL" ? "DISPONIVEL" : destinationBucket === "MANUTENCAO" ? "EM_MANUTENCAO" : "DANIFICADO", currentLocationId: destinationLocationId ?? null, updatedById: command.actor.actorUserId, version: { increment: 1 } } });
    await createAudit(tx, { entityType: "InventoryAssignment", entityId: assignment.id, action: "DEVOLUCAO", operationId: operation.id, actor: command.actor, oldData: assignment, newData: { returnedQuantity, status: closed ? "DEVOLVIDA" : "PARCIALMENTE_DEVOLVIDA", condition: command.condition }, requestId: command.requestId });
    if (maintenance) await createAudit(tx, { entityType: "InventoryMaintenance", entityId: maintenance.id, action: "MANUTENCAO_ABERTA_POR_DEVOLUCAO", operationId: operation.id, actor: command.actor, oldData: null, newData: maintenance, requestId: command.requestId });
    return { operationId: operation.id, produtoId: assignment.produtoId, movementId: movement.id, assignmentId: assignment.id, maintenanceId: maintenance?.id, assetId: assignment.assetId ?? undefined, idempotentReplay: false, availableAfter: cache.available, totalAfter: cache.total };
  });
}

export async function sendInventoryToMaintenance(raw: SendMaintenanceCommand, client: InventoryDb = db) {
  const command = sendMaintenanceCommandSchema.parse(raw);
  const requestHash = inventoryRequestHash(command);
  return runIdempotent(client, command.idempotencyKey, requestHash, async (tx) => {
    const product = await getProduct(tx, command.produtoId);
    const asset = await validateAsset(tx, product, command.assetId, command.quantity);
    assertAssetSource(asset, command.sourceBucket, command.fromLocationId);
    await assertLocation(tx, command.fromLocationId);
    const before = await totalsForProduct(tx, command.produtoId);
    const operation = await createOperation(tx, { ...command, requestHash, type: "MANUTENCAO", metadata: { sourceLocationId: command.fromLocationId ?? null } });
    const maintenance = await tx.inventoryMaintenance.create({ data: { id: randomUUID(), produtoId: command.produtoId, assetId: command.assetId, quantity: command.quantity, reason: command.reason, provider: command.provider, sentAt: command.occurredAt ?? new Date(), expectedAt: command.expectedAt, observacao: command.observacao, openedById: command.actor.actorUserId!, sendOperationId: operation.id } });
    await applyTransition(tx, { produtoId: command.produtoId, quantity: command.quantity, fromBucket: command.sourceBucket, toBucket: "MANUTENCAO", fromLocationId: command.fromLocationId, toLocationId: command.fromLocationId });
    const cache = await syncProductCache(tx, command.produtoId);
    const movement = await tx.inventoryMovement.create({ data: { id: randomUUID(), operationId: operation.id, produtoId: command.produtoId, assetId: command.assetId, maintenanceId: maintenance.id, quantity: command.quantity, fromLocationId: command.fromLocationId, toLocationId: command.fromLocationId, fromBucket: command.sourceBucket, toBucket: "MANUTENCAO", availableBefore: before.DISPONIVEL, availableAfter: cache.available, totalBefore: totalQuantity(before), totalAfter: cache.total } });
    if (asset) await tx.inventoryAsset.update({ where: { id: asset.id }, data: { status: "EM_MANUTENCAO", updatedById: command.actor.actorUserId, version: { increment: 1 } } });
    await createAudit(tx, { entityType: "InventoryMaintenance", entityId: maintenance.id, action: "MANUTENCAO", operationId: operation.id, actor: command.actor, oldData: null, newData: maintenance, requestId: command.requestId });
    return { operationId: operation.id, produtoId: command.produtoId, movementId: movement.id, maintenanceId: maintenance.id, assetId: command.assetId, idempotentReplay: false, availableAfter: cache.available, totalAfter: cache.total };
  });
}

export async function returnInventoryFromMaintenance(raw: ReturnMaintenanceCommand, client: InventoryDb = db) {
  const command = returnMaintenanceCommandSchema.parse(raw);
  const requestHash = inventoryRequestHash(command);
  return runIdempotent(client, command.idempotencyKey, requestHash, async (tx) => {
    const maintenance = await tx.inventoryMaintenance.findUnique({ where: { id: command.maintenanceId }, include: { sendOperation: { select: { metadataJson: true } } } });
    if (!maintenance || maintenance.status !== "ABERTA") throw new InventoryDomainError("MAINTENANCE_NOT_OPEN", "Manutenção não encontrada ou já encerrada.");
    const product = await getProduct(tx, maintenance.produtoId);
    const maintainedAsset = await validateAsset(tx, product, maintenance.assetId ?? undefined, maintenance.quantity);
    await assertLocation(tx, command.toLocationId);
    const destinationBucket: InventoryBucket = command.condition === "BOM" ? "DISPONIVEL" : "DANIFICADO";
    const before = await totalsForProduct(tx, maintenance.produtoId);
    let sourceLocationId: string | undefined;
    try {
      const metadata = JSON.parse(maintenance.sendOperation.metadataJson || "{}") as { sourceLocationId?: string | null };
      sourceLocationId = metadata.sourceLocationId ?? undefined;
    } catch {
      sourceLocationId = undefined;
    }
    assertAssetSource(maintainedAsset, "MANUTENCAO", sourceLocationId);
    const destinationLocationId = command.toLocationId ?? sourceLocationId;
    const operation = await createOperation(tx, { ...command, requestHash, type: "RETORNO_MANUTENCAO", occurredAt: command.returnedAt });
    await applyTransition(tx, { produtoId: maintenance.produtoId, quantity: maintenance.quantity, fromBucket: "MANUTENCAO", toBucket: destinationBucket, fromLocationId: sourceLocationId, toLocationId: destinationLocationId });
    await tx.inventoryMaintenance.update({ where: { id: maintenance.id }, data: { status: "CONCLUIDA", returnedAt: command.returnedAt ?? new Date(), closedById: command.actor.actorUserId, returnOperationId: operation.id } });
    const cache = await syncProductCache(tx, maintenance.produtoId);
    const movement = await tx.inventoryMovement.create({ data: { id: randomUUID(), operationId: operation.id, produtoId: maintenance.produtoId, assetId: maintenance.assetId, maintenanceId: maintenance.id, quantity: maintenance.quantity, fromLocationId: sourceLocationId, toLocationId: destinationLocationId, fromBucket: "MANUTENCAO", toBucket: destinationBucket, availableBefore: before.DISPONIVEL, availableAfter: cache.available, totalBefore: totalQuantity(before), totalAfter: cache.total } });
    if (maintenance.assetId) await tx.inventoryAsset.update({ where: { id: maintenance.assetId }, data: { status: destinationBucket === "DISPONIVEL" ? "DISPONIVEL" : "DANIFICADO", currentLocationId: destinationLocationId ?? null, updatedById: command.actor.actorUserId, version: { increment: 1 } } });
    await createAudit(tx, { entityType: "InventoryMaintenance", entityId: maintenance.id, action: "RETORNO_MANUTENCAO", operationId: operation.id, actor: command.actor, oldData: maintenance, newData: { status: "CONCLUIDA", condition: command.condition }, requestId: command.requestId });
    return { operationId: operation.id, produtoId: maintenance.produtoId, movementId: movement.id, maintenanceId: maintenance.id, assetId: maintenance.assetId ?? undefined, idempotentReplay: false, availableAfter: cache.available, totalAfter: cache.total };
  });
}

export async function registerInventoryAsset(raw: RegisterInventoryAssetCommand, client: InventoryDb = db) {
  const command = registerInventoryAssetCommandSchema.parse(raw);
  const requestHash = inventoryRequestHash(command);
  try {
    return await runIdempotent(client, command.idempotencyKey, requestHash, async (tx) => {
      const product = await getProduct(tx, command.produtoId);
      if (product.trackingMode !== "INDIVIDUAL") throw new InventoryDomainError("NOT_INDIVIDUAL_ITEM", "A unidade patrimonial exige item com controle INDIVIDUAL.");
      await assertLocation(tx, command.locationId);
      const before = await totalsForProduct(tx, command.produtoId);
      const operation = await createOperation(tx, { ...command, requestHash, type: "ENTRADA" });
      const asset = await tx.inventoryAsset.create({ data: { id: randomUUID(), produtoId: command.produtoId, serial: command.serial, patrimonio: command.patrimonio, codigoInterno: command.codigoInterno, status: "DISPONIVEL", currentLocationId: command.locationId, observacoes: command.observacao, createdById: command.actor.actorUserId, updatedById: command.actor.actorUserId } });
      await applyTransition(tx, { produtoId: command.produtoId, quantity: 1, fromBucket: null, toBucket: "DISPONIVEL", toLocationId: command.locationId });
      const cache = await syncProductCache(tx, command.produtoId);
      const movement = await tx.inventoryMovement.create({ data: { id: randomUUID(), operationId: operation.id, produtoId: command.produtoId, assetId: asset.id, quantity: 1, toLocationId: command.locationId, toBucket: "DISPONIVEL", availableBefore: before.DISPONIVEL, availableAfter: cache.available, totalBefore: totalQuantity(before), totalAfter: cache.total } });
      await createAudit(tx, { entityType: "InventoryAsset", entityId: asset.id, action: "UNIDADE_CADASTRADA", operationId: operation.id, actor: command.actor, oldData: null, newData: { produtoId: command.produtoId, serial: command.serial, patrimonio: command.patrimonio, codigoInterno: command.codigoInterno, status: "DISPONIVEL" }, requestId: command.requestId });
      return { operationId: operation.id, produtoId: command.produtoId, movementId: movement.id, assetId: asset.id, idempotentReplay: false, availableAfter: cache.available, totalAfter: cache.total };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new InventoryDomainError("ASSET_IDENTIFIER_CONFLICT", "Serial, patrimônio ou código interno já está cadastrado.");
    }
    throw error;
  }
}

function batchCommandKey(batchKey: string, componentId: string): string {
  return `kit:${inventoryRequestHash(batchKey).slice(0, 24)}:${componentId.slice(0, 80)}:${inventoryRequestHash(componentId).slice(0, 16)}`;
}

export async function executeInventoryBatchInTransaction(
  tx: InventoryTx,
  raw: InventoryBatchInput,
): Promise<InventoryBatchCommandResult[]> {
  const batch = inventoryBatchSchema.parse(raw);
  const kit = await tx.inventoryKitInstance.findFirst({ where: { id: batch.kitInstanceId, archivedAt: null }, select: { id: true } });
  if (!kit) throw new InventoryDomainError("KIT_NOT_FOUND", "Instância de kit não encontrada ou arquivada.");

  const results: InventoryBatchCommandResult[] = [];
  for (const command of batch.commands) {
    const idempotencyKey = batchCommandKey(batch.idempotencyKey, command.kitComponentId);
    const requestHash = inventoryRequestHash({ batchKey: batch.idempotencyKey, kitInstanceId: batch.kitInstanceId, actor: batch.actor, command });
    const existing = await tx.inventoryOperation.findUnique({
      where: { idempotencyKey },
      include: {
        movements: { where: { kitComponentId: command.kitComponentId }, take: 1 },
        assignments: { take: 1 },
      },
    });
    if (existing) {
      if (existing.requestHash !== requestHash) throw new InventoryDomainError("IDEMPOTENCY_CONFLICT", "O lote já foi processado com dados diferentes.");
      const movement = existing.movements[0];
      if (!movement) throw new InventoryDomainError("INCOMPLETE_LEDGER", "Operação de kit sem movimento correspondente.");
      results.push({ kitComponentId: command.kitComponentId, operationId: existing.id, movementId: movement.id, assignmentId: existing.assignments[0]?.id ?? movement.assignmentId ?? undefined, idempotentReplay: true });
      continue;
    }

    const component = await tx.inventoryKitComponent.findFirst({
      where: { id: command.kitComponentId, kitInstanceId: batch.kitInstanceId },
      select: { id: true, produtoId: true, assetId: true, quantity: true },
    });
    if (!component) throw new InventoryDomainError("KIT_COMPONENT_NOT_FOUND", "Componente não pertence à instância de kit informada.");

    if (command.kind === "RETURN") {
      const assignment = await tx.inventoryAssignment.findFirst({ where: { id: command.assignmentId, kitInstanceId: batch.kitInstanceId } });
      if (!assignment || !["ATIVA", "PARCIALMENTE_DEVOLVIDA"].includes(assignment.status)) throw new InventoryDomainError("ASSIGNMENT_NOT_ACTIVE", "Atribuição do componente não está ativa.");
      if (assignment.returnedQuantity + command.quantity > assignment.quantity || command.quantity > component.quantity) throw new InventoryDomainError("RETURN_EXCEEDS_ASSIGNMENT", "A devolução excede a quantidade entregue.");
      const product = await getProduct(tx, component.produtoId);
      if (product.usagePolicy === "CONSUMIVEL") throw new InventoryDomainError("CONSUMABLE_NOT_RETURNABLE", "Componente consumível não gera devolução ao estoque.");
      const returnedAsset = await validateAsset(tx, product, component.assetId ?? undefined, command.quantity);
      assertAssetSource(returnedAsset, "EM_USO", assignment.locationId ?? undefined);
      await assertLocation(tx, command.destinationLocationId);
      const destinationBucket = returnDestination(command.condition);
      const destinationLocationId = command.destinationLocationId ?? assignment.locationId ?? undefined;
      const before = await totalsForProduct(tx, component.produtoId);
      const returnedAt = new Date();
      const operation = await createOperation(tx, { idempotencyKey, requestHash, type: "DEVOLUCAO", actor: batch.actor, observacao: command.observacao, metadata: { kitInstanceId: batch.kitInstanceId, kitComponentId: component.id, ...(command.condition === "NECESSITA_MANUTENCAO" ? { sourceLocationId: destinationLocationId ?? null } : {}) } });
      const returnedQuantity = assignment.returnedQuantity + command.quantity;
      const closed = returnedQuantity === assignment.quantity;
      const assignmentUpdate = await tx.inventoryAssignment.updateMany({
        where: { id: assignment.id, version: assignment.version, returnedQuantity: assignment.returnedQuantity, status: assignment.status },
        data: { returnedQuantity, status: closed ? "DEVOLVIDA" : "PARCIALMENTE_DEVOLVIDA", closedAt: closed ? returnedAt : null, version: { increment: 1 } },
      });
      if (assignmentUpdate.count !== 1) throw new InventoryDomainError("CONCURRENT_RETURN", "A atribuição recebeu outra devolução simultânea. Recarregue e tente novamente.");
      const returnBatch = await tx.inventoryReturnBatch.create({ data: { id: randomUUID(), assignmentId: assignment.id, operationId: operation.id, receivedById: batch.actor.actorUserId!, returnedAt, observacao: command.observacao } });
      await tx.inventoryReturnLine.create({ data: { id: randomUUID(), batchId: returnBatch.id, produtoId: component.produtoId, assetId: component.assetId, kitComponentId: component.id, quantity: command.quantity, condition: command.condition, destinationLocationId, observacao: command.observacao } });
      const maintenance = command.condition === "NECESSITA_MANUTENCAO"
        ? await createMaintenanceFromReturn(tx, { operationId: operation.id, produtoId: component.produtoId, assetId: component.assetId, quantity: command.quantity, actorUserId: batch.actor.actorUserId!, sentAt: returnedAt, observacao: command.observacao })
        : null;
      await applyTransition(tx, { produtoId: component.produtoId, quantity: command.quantity, fromBucket: "EM_USO", toBucket: destinationBucket, fromLocationId: assignment.locationId ?? undefined, toLocationId: destinationLocationId });
      const cache = await syncProductCache(tx, component.produtoId);
      const movement = await tx.inventoryMovement.create({ data: { id: randomUUID(), operationId: operation.id, produtoId: component.produtoId, assetId: component.assetId, assignmentId: assignment.id, maintenanceId: maintenance?.id, kitInstanceId: batch.kitInstanceId, kitComponentId: component.id, quantity: command.quantity, fromLocationId: assignment.locationId, toLocationId: destinationLocationId, fromBucket: "EM_USO", toBucket: destinationBucket, availableBefore: before.DISPONIVEL, availableAfter: cache.available, totalBefore: totalQuantity(before), totalAfter: cache.total } });
      if (component.assetId) await tx.inventoryAsset.update({ where: { id: component.assetId }, data: { status: destinationBucket === "DISPONIVEL" ? "DISPONIVEL" : destinationBucket === "MANUTENCAO" ? "EM_MANUTENCAO" : "DANIFICADO", currentLocationId: destinationLocationId ?? null, updatedById: batch.actor.actorUserId, version: { increment: 1 } } });
      await createAudit(tx, { entityType: "InventoryKitComponent", entityId: component.id, action: "DEVOLUCAO", operationId: operation.id, actor: batch.actor, oldData: { assignmentId: assignment.id, returnedQuantity: assignment.returnedQuantity }, newData: { returnedQuantity, condition: command.condition }, requestId: batch.requestId });
      if (maintenance) await createAudit(tx, { entityType: "InventoryMaintenance", entityId: maintenance.id, action: "MANUTENCAO_ABERTA_POR_DEVOLUCAO", operationId: operation.id, actor: batch.actor, oldData: null, newData: maintenance, requestId: batch.requestId });
      results.push({ kitComponentId: component.id, operationId: operation.id, movementId: movement.id, assignmentId: assignment.id, idempotentReplay: false });
      continue;
    }

    if (component.produtoId !== command.produtoId || component.assetId !== (command.assetId ?? null) || command.quantity > component.quantity) {
      throw new InventoryDomainError("KIT_COMPONENT_MISMATCH", "Produto, patrimônio ou quantidade diverge do componente montado.");
    }
    const product = await getProduct(tx, command.produtoId);
    const asset = await validateAsset(tx, product, command.assetId, command.quantity);
    assertAssetSource(asset, "DISPONIVEL", command.fromLocationId);
    await assertLocation(tx, command.fromLocationId);
    const before = await totalsForProduct(tx, command.produtoId);

    if (command.kind === "STOCK_OUT") {
      if (product.usagePolicy !== "CONSUMIVEL") throw new InventoryDomainError("RETURNABLE_REQUIRES_ASSIGNMENT", "Componente retornável deve ser atribuído, não consumido.");
      const operation = await createOperation(tx, { idempotencyKey, requestHash, type: "SAIDA", actor: batch.actor, observacao: command.observacao, metadata: { kitInstanceId: batch.kitInstanceId, kitComponentId: component.id } });
      await applyTransition(tx, { produtoId: command.produtoId, quantity: command.quantity, fromBucket: "DISPONIVEL", toBucket: null, fromLocationId: command.fromLocationId });
      const cache = await syncProductCache(tx, command.produtoId);
      const movement = await tx.inventoryMovement.create({ data: { id: randomUUID(), operationId: operation.id, produtoId: command.produtoId, assetId: command.assetId, kitInstanceId: batch.kitInstanceId, kitComponentId: component.id, quantity: command.quantity, fromLocationId: command.fromLocationId, fromBucket: "DISPONIVEL", availableBefore: before.DISPONIVEL, availableAfter: cache.available, totalBefore: totalQuantity(before), totalAfter: cache.total } });
      await createAudit(tx, { entityType: "InventoryKitComponent", entityId: component.id, action: "SAIDA", operationId: operation.id, actor: batch.actor, oldData: before, newData: cache.totals, requestId: batch.requestId });
      results.push({ kitComponentId: component.id, operationId: operation.id, movementId: movement.id, idempotentReplay: false });
      continue;
    }

    if (product.usagePolicy === "CONSUMIVEL") throw new InventoryDomainError("CONSUMABLE_NOT_ASSIGNABLE", "Componente consumível deve usar STOCK_OUT.");
    const responsible = await tx.usuarios.findFirst({ where: { id: command.responsibleUserId, status: "ATIVO" }, select: { id: true } });
    if (!responsible) throw new InventoryDomainError("RESPONSIBLE_NOT_FOUND", "Colaborador responsável inexistente ou inativo.");
    await assertLocation(tx, command.toLocationId);
    const operation = await createOperation(tx, { idempotencyKey, requestHash, type: "EM_USO", actor: batch.actor, observacao: command.observacao, metadata: { kitInstanceId: batch.kitInstanceId, kitComponentId: component.id } });
    const assignment = await tx.inventoryAssignment.create({ data: { id: randomUUID(), kitInstanceId: batch.kitInstanceId, responsibleUserId: command.responsibleUserId, sectorId: command.sectorId, locationId: command.toLocationId, quantity: command.quantity, deliveredAt: new Date(), observacao: command.observacao, handedById: batch.actor.actorUserId!, operationId: operation.id } });
    await applyTransition(tx, { produtoId: command.produtoId, quantity: command.quantity, fromBucket: "DISPONIVEL", toBucket: "EM_USO", fromLocationId: command.fromLocationId, toLocationId: command.toLocationId });
    const cache = await syncProductCache(tx, command.produtoId);
    const movement = await tx.inventoryMovement.create({ data: { id: randomUUID(), operationId: operation.id, produtoId: command.produtoId, assetId: command.assetId, assignmentId: assignment.id, kitInstanceId: batch.kitInstanceId, kitComponentId: component.id, quantity: command.quantity, fromLocationId: command.fromLocationId, toLocationId: command.toLocationId, fromBucket: "DISPONIVEL", toBucket: "EM_USO", availableBefore: before.DISPONIVEL, availableAfter: cache.available, totalBefore: totalQuantity(before), totalAfter: cache.total } });
    if (asset) await tx.inventoryAsset.update({ where: { id: asset.id }, data: { status: "EM_USO", currentLocationId: command.toLocationId ?? null, updatedById: batch.actor.actorUserId, version: { increment: 1 } } });
    await createAudit(tx, { entityType: "InventoryKitComponent", entityId: component.id, action: "EM_USO", operationId: operation.id, actor: batch.actor, oldData: before, newData: cache.totals, requestId: batch.requestId });
    results.push({ kitComponentId: component.id, operationId: operation.id, movementId: movement.id, assignmentId: assignment.id, idempotentReplay: false });
  }
  return results;
}

export async function executeInventoryBatch(raw: InventoryBatchInput, client: InventoryDb = db) {
  try {
    return await client.$transaction((tx) => executeInventoryBatchInTransaction(tx, raw));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Uma execução concorrente pode ter vencido a criação das chaves derivadas.
      // Reabrir a transação transforma todos os comandos confirmados em replay.
      return client.$transaction((tx) => executeInventoryBatchInTransaction(tx, raw));
    }
    throw error;
  }
}

export async function inventoryDoctor(client: InventoryDb = db) {
  const [items, balances, operations, movements, assignments, inconsistencies] = await Promise.all([
    client.produtoEstoque.count({ where: { archivedAt: null } }),
    client.inventoryStockBalance.count(), client.inventoryOperation.count(), client.inventoryMovement.count(),
    client.inventoryAssignment.count({ where: { status: { in: ["ATIVA", "PARCIALMENTE_DEVOLVIDA"] } } }),
    client.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS count FROM "ProdutoEstoque" p WHERE p."quantidade" != COALESCE((SELECT SUM(b."quantity") FROM "InventoryStockBalance" b WHERE b."produtoId" = p."id" AND b."bucket" = 'DISPONIVEL'), 0)`,
  ]);
  return { ok: Number(inconsistencies[0]?.count ?? 0) === 0, items, balances, operations, movements, activeAssignments: assignments, inconsistentItems: Number(inconsistencies[0]?.count ?? 0) };
}

export async function inventoryReconcileDryRun(options: { limit?: number } = {}, client: InventoryDb = db) {
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 1_000);
  const rows = await client.$queryRaw<Array<{
    id: string;
    nome: string;
    quantidade: bigint | number;
    quantidadeEmUso: bigint | number;
    quantidadeReservada: bigint | number;
    quantidadeManutencao: bigint | number;
    quantidadeDanificada: bigint | number;
    quantidadeTotal: bigint | number;
    expectedDisponivel: bigint | number;
    expectedEmUso: bigint | number;
    expectedReservada: bigint | number;
    expectedManutencao: bigint | number;
    expectedDanificada: bigint | number;
    expectedTotal: bigint | number;
  }>>(Prisma.sql`
    WITH balance AS (
      SELECT
        "produtoId",
        COALESCE(SUM(CASE WHEN "bucket" = 'DISPONIVEL' THEN "quantity" ELSE 0 END), 0) AS expectedDisponivel,
        COALESCE(SUM(CASE WHEN "bucket" = 'EM_USO' THEN "quantity" ELSE 0 END), 0) AS expectedEmUso,
        COALESCE(SUM(CASE WHEN "bucket" = 'RESERVADO' THEN "quantity" ELSE 0 END), 0) AS expectedReservada,
        COALESCE(SUM(CASE WHEN "bucket" = 'MANUTENCAO' THEN "quantity" ELSE 0 END), 0) AS expectedManutencao,
        COALESCE(SUM(CASE WHEN "bucket" = 'DANIFICADO' THEN "quantity" ELSE 0 END), 0) AS expectedDanificada,
        COALESCE(SUM("quantity"), 0) AS expectedTotal
      FROM "InventoryStockBalance"
      GROUP BY "produtoId"
    )
    SELECT
      p."id", p."nome", p."quantidade", p."quantidadeEmUso", p."quantidadeReservada",
      p."quantidadeManutencao", p."quantidadeDanificada", p."quantidadeTotal",
      COALESCE(b.expectedDisponivel, 0) AS expectedDisponivel,
      COALESCE(b.expectedEmUso, 0) AS expectedEmUso,
      COALESCE(b.expectedReservada, 0) AS expectedReservada,
      COALESCE(b.expectedManutencao, 0) AS expectedManutencao,
      COALESCE(b.expectedDanificada, 0) AS expectedDanificada,
      COALESCE(b.expectedTotal, 0) AS expectedTotal
    FROM "ProdutoEstoque" p
    LEFT JOIN balance b ON b."produtoId" = p."id"
    WHERE p."archivedAt" IS NULL AND (
      p."quantidade" != COALESCE(b.expectedDisponivel, 0) OR
      p."quantidadeEmUso" != COALESCE(b.expectedEmUso, 0) OR
      p."quantidadeReservada" != COALESCE(b.expectedReservada, 0) OR
      p."quantidadeManutencao" != COALESCE(b.expectedManutencao, 0) OR
      p."quantidadeDanificada" != COALESCE(b.expectedDanificada, 0) OR
      p."quantidadeTotal" != COALESCE(b.expectedTotal, 0)
    )
    ORDER BY p."nome", p."id"
    LIMIT ${limit}
  `);
  const divergences = rows.map((row) => ({
    item: { id: row.id, nome: row.nome },
    current: {
      disponivel: Number(row.quantidade), emUso: Number(row.quantidadeEmUso), reservada: Number(row.quantidadeReservada),
      manutencao: Number(row.quantidadeManutencao), danificada: Number(row.quantidadeDanificada), total: Number(row.quantidadeTotal),
    },
    expected: {
      disponivel: Number(row.expectedDisponivel), emUso: Number(row.expectedEmUso), reservada: Number(row.expectedReservada),
      manutencao: Number(row.expectedManutencao), danificada: Number(row.expectedDanificada), total: Number(row.expectedTotal),
    },
  }));
  return { dryRun: true as const, ok: divergences.length === 0, divergenceCount: divergences.length, truncated: divergences.length === limit, divergences };
}

export interface InventoryItemListOptions {
  query?: string;
  categoryId?: string;
  status?: string;
  locationId?: string;
  responsibleUserId?: number;
  tagId?: string;
  stock?: "ALL" | "WITH_STOCK" | "WITHOUT_STOCK" | "LOW_STOCK";
  maintenanceOnly?: boolean;
  limit?: number;
  cursor?: string;
}

export async function listInventoryItems(options: InventoryItemListOptions = {}, client: InventoryDb = db) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const lowStockIds = options.stock === "LOW_STOCK"
    ? (await client.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "ProdutoEstoque" WHERE "archivedAt" IS NULL AND "quantidade" <= "estoqueMinimo"`)).map((row) => row.id)
    : undefined;
  const matchingResponsibleIds = options.query
    ? (await client.usuarios.findMany({ where: { nome: { contains: options.query } }, select: { id: true }, take: 200 })).map((user) => user.id)
    : [];
  const search: Prisma.ProdutoEstoqueWhereInput | undefined = options.query ? {
    OR: [
      { nome: { contains: options.query } },
      { codigoInterno: { contains: options.query } },
      { searchText: { contains: options.query } },
      { categoria: { nome: { contains: options.query } } },
      { inventoryAssets: { some: { OR: [{ serial: { contains: options.query } }, { patrimonio: { contains: options.query } }, { codigoInterno: { contains: options.query } }] } } },
      { inventoryItemTags: { some: { tag: { nome: { contains: options.query } } } } },
      { inventoryTagRequirements: { some: { tag: { nome: { contains: options.query } } } } },
      ...(matchingResponsibleIds.length > 0 ? [
        { inventoryAssignments: { some: { responsibleUserId: { in: matchingResponsibleIds } } } },
        { inventoryMovements: { some: { assignment: { responsibleUserId: { in: matchingResponsibleIds }, status: { in: ["ATIVA", "PARCIALMENTE_DEVOLVIDA"] } } } } },
      ] : []),
    ],
  } : undefined;
  const combinedFilters: Prisma.ProdutoEstoqueWhereInput[] = [];
  if (search) combinedFilters.push(search);
  if (options.tagId) combinedFilters.push({ OR: [
    { inventoryItemTags: { some: { tagId: options.tagId } } },
    { inventoryTagRequirements: { some: { tagId: options.tagId } } },
  ] });
  if (options.locationId) combinedFilters.push({ OR: [
    { defaultLocationId: options.locationId },
    { inventoryBalances: { some: { locationId: options.locationId, quantity: { gt: 0 } } } },
    { inventoryAssets: { some: { currentLocationId: options.locationId, archivedAt: null } } },
    { inventoryAssignments: { some: { locationId: options.locationId, status: { in: ["ATIVA", "PARCIALMENTE_DEVOLVIDA"] } } } },
  ] });
  if (options.responsibleUserId) combinedFilters.push({ OR: [
    { inventoryAssignments: { some: { responsibleUserId: options.responsibleUserId, status: { in: ["ATIVA", "PARCIALMENTE_DEVOLVIDA"] } } } },
    { inventoryMovements: { some: { assignment: { responsibleUserId: options.responsibleUserId, status: { in: ["ATIVA", "PARCIALMENTE_DEVOLVIDA"] } } } } },
  ] });
  const rows = await client.produtoEstoque.findMany({
    where: {
      archivedAt: null,
      AND: combinedFilters,
      ...(options.categoryId ? { categoriaId: options.categoryId } : {}),
      ...(options.status ? { status: options.status } : {}),
      ...(options.stock === "WITH_STOCK" ? { quantidade: { gt: 0 } } : options.stock === "WITHOUT_STOCK" ? { quantidade: 0 } : {}),
      ...(lowStockIds ? { id: { in: lowStockIds } } : {}),
      ...(options.maintenanceOnly ? { quantidadeManutencao: { gt: 0 } } : {}),
    },
    select: {
      id: true, nome: true, imagem: true, codigoInterno: true, trackingMode: true, usagePolicy: true, status: true,
      quantidade: true, quantidadeEmUso: true, quantidadeTotal: true, quantidadeManutencao: true, estoqueMinimo: true, unidade: true,
      categoria: { select: { id: true, nome: true, cor: true, icone: true } },
      inventoryAssets: { where: { archivedAt: null }, select: { id: true, serial: true, patrimonio: true, codigoInterno: true, status: true }, take: 5 },
      inventoryImages: {
        where: { isPrimary: false, deletedAt: null, objectKey: { contains: "/notas-fiscais/" } },
        select: { id: true, url: true, mimeType: true, sizeBytes: true, objectKey: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      inventoryItemTags: { select: { tag: { select: { id: true, nome: true, cor: true, icone: true, kind: true } } }, take: 10 },
    },
    orderBy: [{ nome: "asc" }, { id: "asc" }], take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });
  const hasNext = rows.length > limit;
  const items = rows.slice(0, limit);
  return { items, nextCursor: hasNext ? items.at(-1)?.id ?? null : null };
}

export async function listInventoryMovements(options: { produtoId?: string; responsibleUserId?: number; limit?: number; cursor?: string } = {}, client: InventoryDb = db) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const rows = await client.inventoryMovement.findMany({
    where: {
      ...(options.produtoId ? { produtoId: options.produtoId } : {}),
      ...(options.responsibleUserId ? { assignment: { responsibleUserId: options.responsibleUserId } } : {}),
    },
    include: { operation: { select: { type: true, actorNameSnapshot: true, occurredAt: true, observacao: true, metadataJson: true } }, produto: { select: { nome: true } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });
  const hasNext = rows.length > limit;
  const items = rows.slice(0, limit);
  return { items, nextCursor: hasNext ? items.at(-1)?.id ?? null : null };
}
