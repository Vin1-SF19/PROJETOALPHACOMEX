import "server-only";

import { evaluateExplorerCapability, EXPLORER_CAPABILITIES, type ExplorerCapability } from "@/lib/alpha-explorer/capabilities";
import { normalizeFolderPrefix, normalizeLogicalPath } from "@/lib/alpha-explorer/paths";
import { readExplorerRuntimeFlags } from "@/lib/alpha-explorer/runtime";
import { aclSchema } from "@/lib/alpha-explorer/schemas";
import { resolveStorageTarget } from "@/lib/storage/catalog";
import { runStorageDoctor } from "@/lib/storage/doctor";
import { QuObjectsProvider } from "@/lib/storage/providers/quobjects";
import { readStorageRuntimeConfig } from "@/lib/storage/runtime-config";

type ExplorerCliCommand = "doctor" | "permissions" | "acl-set" | "list" | "reconcile";

export interface ExplorerCliResult {
  ok: boolean;
  command: ExplorerCliCommand;
  code: 0 | 1 | 2;
  checks: Record<string, unknown>;
  timestamp: string;
}

function result(command: ExplorerCliCommand, ok: boolean, code: 0 | 1 | 2, checks: Record<string, unknown>): ExplorerCliResult {
  return { ok, command, code, checks, timestamp: new Date().toISOString() };
}

async function resolveAuthorization(userId: number) {
  const { resolveExplorerAuthorization } = await import("@/lib/alpha-explorer/authorization");
  return resolveExplorerAuthorization(userId);
}

export async function runExplorerDoctor(): Promise<ExplorerCliResult> {
  const flags = readExplorerRuntimeFlags();
  const storage = await runStorageDoctor();
  return result("doctor", storage.ok, storage.code, {
    flags,
    storage: storage.checks,
    limits: { maximumObjectBytes: 2 * 1024 ** 3, partSizeMiB: 64 },
  });
}

export async function runExplorerPermissions(input: {
  userId: number;
  path: string;
  capability: ExplorerCapability;
}): Promise<ExplorerCliResult> {
  const authorization = await resolveAuthorization(input.userId);
  const decision = authorization.moduleAllowed
    ? evaluateExplorerCapability(authorization.grants, input.path, input.capability)
    : null;
  const ok = Boolean(authorization.active && authorization.moduleAllowed && decision?.allowed);
  return result("permissions", ok, ok ? 0 : 1, {
    userId: input.userId,
    active: authorization.active,
    moduleAllowed: authorization.moduleAllowed,
    admin: authorization.admin,
    path: decision?.normalizedPath ?? normalizeLogicalPath(input.path),
    capability: input.capability,
    allowed: decision?.allowed ?? false,
    source: decision?.matchedGrant?.source ?? null,
  });
}

export async function runExplorerAclSet(input: {
  userId: number;
  subjectType: "USER" | "ROLE" | "CARGO";
  subjectId: string;
  prefix: string;
  capabilities: ExplorerCapability[];
  execute?: boolean;
  confirm?: string;
}): Promise<ExplorerCliResult> {
  const authorization = await resolveAuthorization(input.userId);
  if (!authorization.admin) return result("acl-set", false, 1, { authorized: false });
  const proposed = aclSchema.parse({
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    prefix: input.prefix,
    capabilities: input.capabilities,
  });
  if (!input.execute) return result("acl-set", true, 0, { authorized: true, dryRun: true, proposed });
  if (input.confirm !== "alpha-explorer-acl") {
    return result("acl-set", false, 1, { authorized: true, safety: { ok: false, errorCode: "CONFIRMATION_REQUIRED" }, proposed });
  }
  const { upsertExplorerAcl } = await import("@/lib/alpha-explorer/service");
  const acl = await upsertExplorerAcl(input.userId, proposed);
  return result("acl-set", true, 0, { authorized: true, dryRun: false, acl });
}

async function explorerStorage() {
  const runtime = readStorageRuntimeConfig();
  if (!runtime.ok) return { ok: false as const, issues: runtime.issues };
  const target = resolveStorageTarget("documentos", runtime.config);
  return { ok: true as const, target, provider: new QuObjectsProvider(runtime.config) };
}

export async function runExplorerList(input: {
  userId: number;
  prefix: string;
  continuationToken?: string;
  limit?: number;
}): Promise<ExplorerCliResult> {
  const authorization = await resolveAuthorization(input.userId);
  const normalized = normalizeLogicalPath(input.prefix);
  const decision = authorization.moduleAllowed
    ? evaluateExplorerCapability(authorization.grants, normalized, "list")
    : null;
  if (!decision?.allowed) return result("list", false, 1, { authorized: false, prefix: normalized });

  const storage = await explorerStorage();
  if (!storage.ok) return result("list", false, 2, { config: { ok: false, issues: storage.issues } });
  const listed = await storage.provider.listObjects(
    storage.target,
    normalizeFolderPrefix(normalized),
    input.continuationToken,
    input.limit,
  );
  return result("list", true, 0, {
    authorized: true,
    provider: storage.provider.id,
    prefix: normalized,
    objects: listed.objects.map((object) => ({
      size: object.size,
      path: object.objectKey.slice(normalizeFolderPrefix(normalized).length),
    })),
    prefixes: listed.prefixes.map((prefix) => prefix.slice(normalizeFolderPrefix(normalized).length)),
    continuationToken: listed.continuationToken,
  });
}

export async function runExplorerReconcile(input: { userId: number; prefix: string; execute?: boolean; confirm?: string }): Promise<ExplorerCliResult> {
  const authorization = await resolveAuthorization(input.userId);
  if (!authorization.admin) return result("reconcile", false, 1, { authorized: false });
  if (input.execute && input.confirm !== "alpha-explorer-reconcile") {
    return result("reconcile", false, 1, { authorized: true, safety: { ok: false, errorCode: "CONFIRMATION_REQUIRED" } });
  }
  const storage = await explorerStorage();
  if (!storage.ok) return result("reconcile", false, 2, { config: { ok: false, issues: storage.issues } });
  const prefix = normalizeFolderPrefix(input.prefix);
  const uploads = await storage.provider.listMultipartUploads(storage.target, prefix);
  const { default: db } = await import("@/lib/prisma");
  const [expiredSessions, pendingOperations, registeredItems] = await Promise.all([
    db.alphaExplorerUploadSession.findMany({
      where: { status: { in: ["CREATED", "UPLOADING", "COMPLETING", "CANCELLED_RECONCILE"] }, expiresAt: { lt: new Date() } },
      select: { id: true, provider: true, status: true, expiresAt: true, objectKey: true, uploadId: true, bucketStore: true, declaredMime: true }, take: 1_000,
    }),
    db.alphaExplorerOperation.findMany({
      where: { status: { in: ["COPYING", "RECONCILE"] } }, select: { id: true, type: true, status: true, errorCode: true }, take: 1_000,
    }),
    db.alphaExplorerItem.findMany({
      where: { kind: "FILE", status: "ACTIVE", provider: "quobjects", objectKey: { not: null } },
      select: { id: true, objectKey: true }, take: 100,
    }),
  ]);
  const missingRegisteredItems: string[] = [];
  for (const item of registeredItems) {
    if (!item.objectKey) continue;
    const exists = await storage.provider.head(storage.target, item.objectKey).then(() => true).catch(() => false);
    if (!exists) missingRegisteredItems.push(item.id);
  }
  const cleanup = { aborted: [] as string[], reconcileRequired: [] as string[], failed: [] as string[] };
  if (input.execute) {
    for (const session of expiredSessions) {
      if (session.provider === "quobjects" && session.uploadId) {
        try {
          await storage.provider.abortMultipart({
            provider: "quobjects",
            logicalStorage: "documentos",
            bucketOrStore: session.bucketStore,
            objectKey: session.objectKey,
            uploadId: session.uploadId,
            contentType: session.declaredMime ?? "application/octet-stream",
          });
          await db.alphaExplorerUploadSession.update({ where: { id: session.id }, data: { status: "CANCELLED", failureCode: "SESSION_EXPIRED" } });
          cleanup.aborted.push(session.id);
        } catch {
          await db.alphaExplorerUploadSession.update({ where: { id: session.id }, data: { status: "CANCELLED_RECONCILE", failureCode: "ABORT_FAILED" } });
          cleanup.failed.push(session.id);
        }
      } else {
        await db.alphaExplorerUploadSession.update({ where: { id: session.id }, data: { status: "CANCELLED_RECONCILE", failureCode: "PROVIDER_ABORT_UNAVAILABLE" } });
        cleanup.reconcileRequired.push(session.id);
      }
    }
  }
  return result("reconcile", true, 0, {
    dryRun: !input.execute,
    provider: storage.provider.id,
    prefix,
    incompleteUploads: uploads.uploads.map((upload) => ({
      objectKey: upload.objectKey,
      uploadId: upload.uploadId,
      initiatedAt: upload.initiatedAt?.toISOString(),
    })),
    expiredSessions,
    pendingOperations,
    missingRegisteredItems,
    cleanup,
    continuationToken: uploads.continuationToken,
  });
}

export function parseExplorerCapability(value: string): ExplorerCapability {
  const capability = EXPLORER_CAPABILITIES.find((candidate) => candidate === value);
  if (!capability) throw new Error("INVALID_CAPABILITY");
  return capability;
}
