import "server-only";

import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import db from "@/lib/prisma";
import { normalizeEtag, STORAGE_MAX_OBJECT_SIZE, type StorageCompletedPart, type StorageMultipartSession } from "@/lib/storage/contracts";
import type { ExplorerUserAuthorization } from "./authorization";
import { evaluateExplorerCapability, type ExplorerCapability } from "./capabilities";
import { ExplorerError } from "./errors";
import { auditExplorer, createSupportId, writeExplorerLog } from "./observability";
import { joinLogicalPath, logicalParent, normalizeLogicalPath } from "./paths";
import { createExplorerStorage, providerById } from "./storage";

const providerSchema = z.enum(["quobjects", "vercel-blob"]);
const ITEM_SELECT = {
  id: true, kind: true, name: true, logicalPath: true, parentPath: true, provider: true,
  sizeBytes: true, validatedMime: true, status: true, version: true, createdAt: true, updatedAt: true, deletedAt: true,
} as const;

export const EXPLORER_ROOTS = ["comercial", "financeiro", "fiscal", "operacional", "rh", "compartilhados"] as const;

function normalizeName(name: string): { name: string; normalizedName: string } {
  const normalized = normalizeLogicalPath(name);
  if (!normalized || normalized.includes("/")) throw new ExplorerError("INVALID_NAME", 400, "Nome inválido");
  return { name: normalized, normalizedName: normalized.toLocaleLowerCase("pt-BR") };
}

function serializeItem(item: {
  id: string; kind: string; name: string; logicalPath: string; parentPath: string; provider: string | null;
  sizeBytes: bigint | null; validatedMime: string | null; status: string; version: number;
  createdAt: Date; updatedAt: Date; deletedAt: Date | null;
}) {
  return {
    ...item,
    sizeBytes: item.sizeBytes === null ? null : Number(item.sizeBytes),
    providerLabel: item.provider === "quobjects" ? "NAS" : item.provider === "vercel-blob" ? "Vercel Blob" : null,
  };
}

function assertCapability(authorization: ExplorerUserAuthorization, path: string, capability: ExplorerCapability): void {
  if (!authorization.active || !authorization.moduleAllowed || !evaluateExplorerCapability(authorization.grants, path, capability).allowed) {
    throw new ExplorerError("NOT_FOUND", 404, "Item não encontrado");
  }
}

async function assertNoConflict(parentPath: string, normalizedName: string, ignoredId?: string): Promise<void> {
  const conflict = await db.alphaExplorerItem.findFirst({
    where: { parentPath, normalizedName, status: "ACTIVE", ...(ignoredId ? { id: { not: ignoredId } } : {}) },
    select: { id: true },
  });
  if (conflict) throw new ExplorerError("NAME_CONFLICT", 409, "Já existe um item com esse nome");
}

export async function listExplorerItems(input: {
  path: string; query: string; sort: "name" | "size" | "createdAt"; direction: "asc" | "desc";
  page: number; limit: number; trash: boolean; authorization: ExplorerUserAuthorization;
}) {
  const path = normalizeLogicalPath(input.path);
  assertCapability(input.authorization, path, input.trash ? "restore" : "list");
  const where = input.trash
    ? { status: "TRASHED", logicalPath: path ? { startsWith: `${path}/` } : undefined }
    : { status: "ACTIVE", parentPath: path, name: input.query ? { contains: input.query } : undefined };
  const [items, total] = await db.$transaction([
    db.alphaExplorerItem.findMany({
      where,
      select: ITEM_SELECT,
      orderBy: [{ kind: "desc" }, { [input.sort]: input.direction }, { id: "asc" }],
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    db.alphaExplorerItem.count({ where }),
  ]);

  const virtualRoots = !input.trash && !input.query && path === "" && input.page === 1
    ? EXPLORER_ROOTS.filter((root) => evaluateExplorerCapability(input.authorization.grants, root, "list").allowed)
      .map((root) => ({ id: `root:${root}`, kind: "FOLDER", name: root, logicalPath: root, parentPath: "", provider: null,
        sizeBytes: null, validatedMime: null, status: "ACTIVE", version: 1, createdAt: new Date(0), updatedAt: new Date(0), deletedAt: null }))
    : [];
  return { items: [...virtualRoots.map(serializeItem), ...items.map(serializeItem)], total: total + virtualRoots.length, page: input.page, limit: input.limit };
}

export async function createExplorerFolder(userId: number, authorization: ExplorerUserAuthorization, path: string, rawName: string) {
  const parentPath = normalizeLogicalPath(path);
  assertCapability(authorization, parentPath, "create_folder");
  const { name, normalizedName } = normalizeName(rawName);
  const logicalPath = joinLogicalPath(parentPath, name);
  await assertNoConflict(parentPath, normalizedName);
  const item = await db.alphaExplorerItem.create({ data: {
    kind: "FOLDER", name, normalizedName, logicalPath, parentPath, createdById: userId,
  }, select: ITEM_SELECT });
  await auditExplorer(userId, "FOLDER_CREATED", { itemId: item.id, logicalPath });
  return serializeItem(item);
}

function safeExtension(name: string): string {
  const match = /\.([a-z0-9]{1,12})$/i.exec(name);
  return match ? `.${match[1].toLowerCase()}` : "";
}

export async function initiateExplorerUpload(input: {
  userId: number; authorization: ExplorerUserAuthorization; path: string; name: string; size: number; mime: string;
  fallbackEnabled: boolean;
}) {
  const destinationPath = normalizeLogicalPath(input.path);
  assertCapability(input.authorization, destinationPath, "upload");
  if (input.size < 1 || input.size > STORAGE_MAX_OBJECT_SIZE) throw new ExplorerError("SIZE_INVALID", 413, "Arquivo fora do limite de 2 GiB");
  const { name, normalizedName } = normalizeName(input.name);
  await assertNoConflict(destinationPath, normalizedName);
  const activeSession = await db.alphaExplorerUploadSession.findFirst({
    where: { destinationPath, normalizedName, status: { in: ["CREATED", "UPLOADING", "COMPLETING"] }, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  if (activeSession) throw new ExplorerError("UPLOAD_CONFLICT", 409, "Já existe um upload ativo para esse nome");

  const startedAt = Date.now();
  const storage = createExplorerStorage();
  const primaryHealth = await storage.quobjects.diagnose(storage.target);
  let provider = providerSchema.parse("quobjects");
  if (!primaryHealth.ok) {
    if (!input.fallbackEnabled) throw new ExplorerError("NAS_UNAVAILABLE", 503, "NAS indisponível e fallback desabilitado");
    if (storage.config.blobAccess !== "private") throw new ExplorerError("FALLBACK_NOT_PRIVATE", 503, "Fallback privado não configurado");
    const fallbackHealth = await storage.blob.diagnose(storage.target);
    if (!fallbackHealth.ok) throw new ExplorerError("STORAGE_UNAVAILABLE", 503, "Providers indisponíveis");
    provider = providerSchema.parse("vercel-blob");
  }

  const objectKey = `alpha-explorer/${randomUUID()}${safeExtension(name)}`;
  const expiresAt = new Date(Date.now() + 2 * 60 * 60_000);
  if (provider === "vercel-blob") {
    const clientToken = await generateClientTokenFromReadWriteToken({
      token: storage.config.blobToken,
      pathname: objectKey,
      maximumSizeInBytes: input.size,
      allowedContentTypes: [input.mime],
      validUntil: expiresAt.getTime(),
      addRandomSuffix: false,
      allowOverwrite: false,
    });
    const session = await db.alphaExplorerUploadSession.create({ data: {
      userId: input.userId, destinationPath, displayName: name, normalizedName, objectKey,
      provider, bucketStore: storage.target.fallbackStore, declaredSize: BigInt(input.size), declaredMime: input.mime,
      partSizeBytes: storage.config.partSizeBytes, expiresAt,
    }, select: { id: true } });
    await auditExplorer(input.userId, "UPLOAD_STARTED", { sessionId: session.id, provider, sizeBytes: input.size, fallback: true });
    writeExplorerLog({ correlationId: createSupportId(), action: "upload_started", result: "success", userId: input.userId, provider, sizeBytes: input.size, durationMs: Date.now() - startedAt });
    return { sessionId: session.id, provider, uploadMode: "vercel-client" as const, clientToken, pathname: objectKey, partSize: storage.config.partSizeBytes, expiresAt };
  }

  const multipart = await storage.quobjects.startMultipart({ target: storage.target, objectKey, contentType: input.mime });
  try {
    const session = await db.alphaExplorerUploadSession.create({ data: {
      userId: input.userId, destinationPath, displayName: name, normalizedName, objectKey,
      provider, bucketStore: multipart.bucketOrStore, uploadId: multipart.uploadId, declaredSize: BigInt(input.size),
      declaredMime: input.mime, partSizeBytes: storage.config.partSizeBytes, expiresAt,
    }, select: { id: true } });
    const count = Math.ceil(input.size / storage.config.partSizeBytes);
    const firstWindow = await Promise.all(Array.from({ length: Math.min(4, count) }, async (_, index) => ({
      partNumber: index + 1,
      url: await storage.quobjects.createUploadPartUrl(multipart, index + 1, 300),
    })));
    await auditExplorer(input.userId, "UPLOAD_STARTED", { sessionId: session.id, provider, sizeBytes: input.size, parts: count });
    return { sessionId: session.id, provider, uploadMode: "presigned-parts" as const, parts: firstWindow, partSize: storage.config.partSizeBytes, expiresAt };
  } catch (error) {
    await storage.quobjects.abortMultipart(multipart).catch(() => undefined);
    throw error;
  }
}

async function ownedUploadSession(userId: number, sessionId: string) {
  const session = await db.alphaExplorerUploadSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) throw new ExplorerError("NOT_FOUND", 404, "Sessão não encontrada");
  if (session.expiresAt <= new Date()) throw new ExplorerError("SESSION_EXPIRED", 409, "Sessão expirada");
  return session;
}

function storageSession(session: Awaited<ReturnType<typeof ownedUploadSession>>): StorageMultipartSession {
  if (!session.uploadId) throw new ExplorerError("INVALID_UPLOAD_STATE", 409, "Sessão multipart inválida");
  return {
    provider: providerSchema.parse(session.provider), logicalStorage: "documentos", bucketOrStore: session.bucketStore,
    objectKey: session.objectKey, uploadId: session.uploadId, contentType: session.declaredMime ?? "application/octet-stream",
  };
}

export async function signExplorerParts(userId: number, authorization: ExplorerUserAuthorization, sessionId: string, partNumbers: number[]) {
  const session = await ownedUploadSession(userId, sessionId);
  assertCapability(authorization, session.destinationPath, "upload");
  if (session.provider !== "quobjects" || !["CREATED", "UPLOADING"].includes(session.status)) throw new ExplorerError("INVALID_UPLOAD_STATE", 409, "Estado de upload inválido");
  const maxPart = Math.ceil(Number(session.declaredSize) / session.partSizeBytes);
  if (new Set(partNumbers).size !== partNumbers.length || partNumbers.some((part) => part > maxPart)) throw new ExplorerError("INVALID_PART", 400, "Parte inválida");
  const storage = createExplorerStorage();
  const multipart = storageSession(session);
  await db.alphaExplorerUploadSession.update({ where: { id: session.id }, data: { status: "UPLOADING" } });
  return Promise.all(partNumbers.map(async (partNumber) => ({ partNumber, url: await storage.quobjects.createUploadPartUrl(multipart, partNumber, 300) })));
}

export async function listExplorerUploadedParts(userId: number, authorization: ExplorerUserAuthorization, sessionId: string) {
  const session = await ownedUploadSession(userId, sessionId);
  assertCapability(authorization, session.destinationPath, "upload");
  if (session.provider !== "quobjects") throw new ExplorerError("INVALID_UPLOAD_STATE", 409, "Sessão não usa partes assinadas");
  return createExplorerStorage().quobjects.listUploadedParts(storageSession(session));
}

export async function completeExplorerUpload(userId: number, authorization: ExplorerUserAuthorization, sessionId: string, rawParts: StorageCompletedPart[]) {
  const session = await ownedUploadSession(userId, sessionId);
  assertCapability(authorization, session.destinationPath, "upload");
  if (session.provider !== "quobjects" || !["CREATED", "UPLOADING"].includes(session.status)) throw new ExplorerError("INVALID_UPLOAD_STATE", 409, "Estado de upload inválido");
  const parts = rawParts.map((part) => ({ ...part, etag: normalizeEtag(part.etag) })).sort((left, right) => left.partNumber - right.partNumber);
  const expectedParts = Math.ceil(Number(session.declaredSize) / session.partSizeBytes);
  if (parts.length !== expectedParts || new Set(parts.map((part) => part.partNumber)).size !== parts.length || parts.some((part, index) => part.partNumber !== index + 1)) {
    throw new ExplorerError("INVALID_PARTS", 409, "Lista de partes incompleta");
  }
  if (parts.reduce((total, part) => total + part.size, 0) !== Number(session.declaredSize)) throw new ExplorerError("SIZE_MISMATCH", 409, "Tamanho enviado divergente");
  await db.alphaExplorerUploadSession.update({ where: { id: session.id }, data: { status: "COMPLETING" } });
  const storage = createExplorerStorage();
  const multipart = storageSession(session);
  try {
    await storage.quobjects.completeMultipart(multipart, parts);
  } catch (error) {
    const recovered = await storage.quobjects.head(storage.target, session.objectKey).catch(() => null);
    if (!recovered || recovered.size !== Number(session.declaredSize)) {
      await db.alphaExplorerUploadSession.update({ where: { id: session.id }, data: { status: "FAILED", failureCode: "COMPLETE_FAILED" } });
      throw error;
    }
  }
  return finalizeCompletedUpload(userId, authorization, session.id);
}

export async function finalizeCompletedUpload(userId: number, authorization: ExplorerUserAuthorization, sessionId: string) {
  const session = await ownedUploadSession(userId, sessionId);
  assertCapability(authorization, session.destinationPath, "upload");
  if (!["CREATED", "UPLOADING", "COMPLETING"].includes(session.status)) throw new ExplorerError("INVALID_UPLOAD_STATE", 409, "Estado de upload inválido");
  const storage = createExplorerStorage();
  const providerId = providerSchema.parse(session.provider);
  const metadata = await providerById(storage, providerId).head(storage.target, session.objectKey);
  if (metadata.size !== Number(session.declaredSize)) {
    await db.alphaExplorerUploadSession.update({ where: { id: session.id }, data: { status: "FAILED", finalSize: BigInt(metadata.size), failureCode: "SIZE_MISMATCH" } });
    throw new ExplorerError("SIZE_MISMATCH", 409, "Tamanho final divergente");
  }
  await assertNoConflict(session.destinationPath, session.normalizedName);
  const logicalPath = joinLogicalPath(session.destinationPath, session.displayName);
  const item = await db.$transaction(async (transaction) => {
    const claimed = await transaction.alphaExplorerUploadSession.updateMany({ where: { id: session.id, status: { in: ["CREATED", "UPLOADING", "COMPLETING"] } }, data: { status: "COMPLETED", finalSize: BigInt(metadata.size), completedAt: new Date() } });
    if (claimed.count !== 1) throw new ExplorerError("UPLOAD_ALREADY_FINALIZED", 409, "Upload já finalizado");
    const created = await transaction.alphaExplorerItem.create({ data: {
      kind: "FILE", name: session.displayName, normalizedName: session.normalizedName, logicalPath,
      parentPath: session.destinationPath, objectKey: session.objectKey, provider: providerId,
      bucketStore: session.bucketStore, sizeBytes: BigInt(metadata.size), declaredMime: session.declaredMime,
      validatedMime: metadata.contentType || "application/octet-stream", checksum: metadata.checksum, createdById: userId,
    }, select: ITEM_SELECT });
    await transaction.alphaExplorerUploadSession.update({ where: { id: session.id }, data: { itemId: created.id } });
    return created;
  });
  await auditExplorer(userId, "UPLOAD_COMPLETED", { itemId: item.id, provider: providerId, sizeBytes: metadata.size });
  return serializeItem(item);
}

export async function cancelExplorerUpload(userId: number, authorization: ExplorerUserAuthorization, sessionId: string) {
  const session = await ownedUploadSession(userId, sessionId);
  assertCapability(authorization, session.destinationPath, "upload");
  if (!["CREATED", "UPLOADING", "COMPLETING"].includes(session.status)) throw new ExplorerError("INVALID_UPLOAD_STATE", 409, "Upload não pode ser cancelado");
  let abortPending = false;
  if (session.provider === "quobjects") {
    const storage = createExplorerStorage();
    await storage.quobjects.abortMultipart(storageSession(session)).catch(() => { abortPending = true; });
  } else {
    abortPending = true;
  }
  await db.alphaExplorerUploadSession.update({ where: { id: session.id }, data: { status: abortPending ? "CANCELLED_RECONCILE" : "CANCELLED" } });
  await auditExplorer(userId, "UPLOAD_CANCELLED", { sessionId, provider: session.provider, abortPending });
  return { cancelled: true, abortPending };
}

async function authorizedItem(id: string, authorization: ExplorerUserAuthorization, capability: ExplorerCapability) {
  const item = await db.alphaExplorerItem.findUnique({ where: { id } });
  if (!item) throw new ExplorerError("NOT_FOUND", 404, "Item não encontrado");
  assertCapability(authorization, item.logicalPath, capability);
  return item;
}

export async function createExplorerDownload(userId: number, authorization: ExplorerUserAuthorization, id: string) {
  const item = await authorizedItem(id, authorization, "read");
  if (item.kind !== "FILE" || item.status !== "ACTIVE" || !item.objectKey || !item.provider) throw new ExplorerError("NOT_FOUND", 404, "Arquivo não encontrado");
  const storage = createExplorerStorage();
  const provider = providerById(storage, providerSchema.parse(item.provider));
  const url = await provider.createDownloadUrl(storage.target, item.objectKey, 120);
  await auditExplorer(userId, "DOWNLOAD_AUTHORIZED", { itemId: item.id, provider: item.provider });
  return { url, expiresInSeconds: 120, fileName: item.name };
}

export async function mutateExplorerItem(input: {
  userId: number; authorization: ExplorerUserAuthorization; id: string; version: number;
  action: "rename" | "move" | "delete" | "restore"; name?: string; destinationPath?: string;
}) {
  const capability = input.action === "delete" ? "delete" : input.action === "restore" ? "restore" : input.action;
  const item = await authorizedItem(input.id, input.authorization, capability);
  if (item.version !== input.version) throw new ExplorerError("VERSION_CONFLICT", 409, "O item foi alterado em outra sessão");
  if (input.action === "delete") {
    if (item.status !== "ACTIVE") throw new ExplorerError("INVALID_STATE", 409, "Item já está na lixeira");
    const claimed = await db.alphaExplorerItem.updateMany({ where: { id: item.id, version: input.version, status: "ACTIVE" }, data: { status: "TRASHED", deletedAt: new Date(), deletedById: input.userId, version: { increment: 1 } } });
    if (claimed.count !== 1) throw new ExplorerError("VERSION_CONFLICT", 409, "O item foi alterado em outra sessão");
    const updated = await db.alphaExplorerItem.findUniqueOrThrow({ where: { id: item.id }, select: ITEM_SELECT });
    await auditExplorer(input.userId, "ITEM_DELETED", { itemId: item.id, kind: item.kind });
    return serializeItem(updated);
  }
  if (input.action === "restore") {
    if (item.status !== "TRASHED") throw new ExplorerError("INVALID_STATE", 409, "Item não está na lixeira");
    await assertNoConflict(item.parentPath, item.normalizedName, item.id);
    const claimed = await db.alphaExplorerItem.updateMany({ where: { id: item.id, version: input.version, status: "TRASHED" }, data: { status: "ACTIVE", deletedAt: null, deletedById: null, version: { increment: 1 } } });
    if (claimed.count !== 1) throw new ExplorerError("VERSION_CONFLICT", 409, "O item foi alterado em outra sessão");
    const updated = await db.alphaExplorerItem.findUniqueOrThrow({ where: { id: item.id }, select: ITEM_SELECT });
    await auditExplorer(input.userId, "ITEM_RESTORED", { itemId: item.id, kind: item.kind });
    return serializeItem(updated);
  }

  const destinationPath = input.action === "move" ? normalizeLogicalPath(input.destinationPath ?? "") : item.parentPath;
  assertCapability(input.authorization, destinationPath, input.action === "move" ? "move" : "rename");
  const nextName = input.action === "rename" ? normalizeName(input.name ?? "") : { name: item.name, normalizedName: item.normalizedName };
  await assertNoConflict(destinationPath, nextName.normalizedName, item.id);
  if (item.kind === "FOLDER") {
    const descendants = await db.alphaExplorerItem.count({ where: { logicalPath: { startsWith: `${item.logicalPath}/` }, status: "ACTIVE" } });
    if (descendants > 0) throw new ExplorerError("RECURSIVE_MOVE_UNSUPPORTED", 409, "Movimento de pasta não vazia ainda não é suportado");
    const logicalPath = joinLogicalPath(destinationPath, nextName.name);
    const claimed = await db.alphaExplorerItem.updateMany({ where: { id: item.id, version: input.version, status: "ACTIVE" }, data: { ...nextName, parentPath: destinationPath, logicalPath, version: { increment: 1 } } });
    if (claimed.count !== 1) throw new ExplorerError("VERSION_CONFLICT", 409, "O item foi alterado em outra sessão");
    const updated = await db.alphaExplorerItem.findUniqueOrThrow({ where: { id: item.id }, select: ITEM_SELECT });
    await auditExplorer(input.userId, input.action === "move" ? "ITEM_MOVED" : "ITEM_RENAMED", { itemId: item.id, kind: item.kind });
    return serializeItem(updated);
  }
  if (!item.objectKey || !item.provider) throw new ExplorerError("INVALID_STATE", 409, "Registro de arquivo inconsistente");
  const storage = createExplorerStorage();
  const providerId = providerSchema.parse(item.provider);
  const provider = providerId === "quobjects" ? storage.quobjects : storage.blob;
  const destinationObjectKey = `alpha-explorer/${randomUUID()}${safeExtension(nextName.name)}`;
  const operation = await db.alphaExplorerOperation.create({ data: {
    itemId: item.id, type: input.action.toUpperCase(), status: "COPYING", provider: providerId,
    sourcePath: item.logicalPath, destinationPath: joinLogicalPath(destinationPath, nextName.name),
    sourceObjectKey: item.objectKey, destinationObjectKey, requestedById: input.userId, startedAt: new Date(),
  } });
  const claimed = await db.alphaExplorerItem.updateMany({
    where: { id: item.id, version: input.version, status: "ACTIVE" },
    data: { status: "MOVING", version: { increment: 1 } },
  });
  if (claimed.count !== 1) {
    await db.alphaExplorerOperation.update({ where: { id: operation.id }, data: { status: "CANCELLED", errorCode: "VERSION_CONFLICT" } });
    throw new ExplorerError("VERSION_CONFLICT", 409, "Item alterado durante a operação");
  }
  let copied;
  try {
    copied = await provider.copyObject(storage.target, item.objectKey, destinationObjectKey);
  } catch (error) {
    await db.$transaction([
      db.alphaExplorerItem.update({ where: { id: item.id }, data: { status: "ACTIVE" } }),
      db.alphaExplorerOperation.update({ where: { id: operation.id }, data: { status: "FAILED", errorCode: "COPY_FAILED", completedAt: new Date() } }),
    ]);
    throw error;
  }
  if (copied.size !== Number(item.sizeBytes ?? -1)) {
    await db.alphaExplorerOperation.update({ where: { id: operation.id }, data: { status: "RECONCILE", errorCode: "COPY_SIZE_MISMATCH" } });
    throw new ExplorerError("COPY_SIZE_MISMATCH", 409, "Cópia não pôde ser confirmada");
  }
  try {
    await provider.delete(storage.target, item.objectKey);
  } catch {
    await db.alphaExplorerOperation.update({ where: { id: operation.id }, data: { status: "RECONCILE", errorCode: "SOURCE_DELETE_FAILED" } });
    throw new ExplorerError("MOVE_RECONCILE_REQUIRED", 409, "Cópia concluída; remoção da origem requer reconciliação");
  }
  const updated = await db.$transaction(async (transaction) => {
    const finalized = await transaction.alphaExplorerItem.updateMany({ where: { id: item.id, version: input.version + 1, status: "MOVING" }, data: {
      ...nextName, parentPath: destinationPath, logicalPath: joinLogicalPath(destinationPath, nextName.name), objectKey: destinationObjectKey, status: "ACTIVE",
    } });
    if (finalized.count !== 1) throw new ExplorerError("MOVE_RECONCILE_REQUIRED", 409, "Arquivo movido; metadados requerem reconciliação");
    await transaction.alphaExplorerOperation.update({ where: { id: operation.id }, data: { status: "COMPLETED", completedAt: new Date() } });
    return transaction.alphaExplorerItem.findUniqueOrThrow({ where: { id: item.id }, select: ITEM_SELECT });
  });
  await auditExplorer(input.userId, input.action === "move" ? "ITEM_MOVED" : "ITEM_RENAMED", { itemId: item.id, provider: providerId });
  return serializeItem(updated);
}

export async function upsertExplorerAcl(userId: number, input: { subjectType: string; subjectId: string; prefix: string; capabilities: readonly string[] }) {
  const prefix = normalizeLogicalPath(input.prefix);
  const authorization = await import("./authorization").then((module) => module.resolveExplorerAuthorization(userId));
  assertCapability(authorization, prefix, "manage_permissions");
  const acl = await db.alphaExplorerAcl.upsert({
    where: { subjectType_subjectId_prefix: { subjectType: input.subjectType, subjectId: input.subjectId, prefix } },
    create: { subjectType: input.subjectType, subjectId: input.subjectId, prefix, capabilitiesJson: JSON.stringify(input.capabilities), createdById: userId },
    update: { capabilitiesJson: JSON.stringify(input.capabilities), createdById: userId },
    select: { id: true, subjectType: true, subjectId: true, prefix: true, capabilitiesJson: true, updatedAt: true },
  });
  await auditExplorer(userId, "PERMISSION_CHANGED", { aclId: acl.id, subjectType: acl.subjectType, prefix });
  return { ...acl, capabilities: input.capabilities, capabilitiesJson: undefined };
}

export function parentForBreadcrumb(path: string): string | null { return logicalParent(path); }
