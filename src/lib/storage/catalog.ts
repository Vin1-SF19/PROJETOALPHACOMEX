import "server-only";

import type { LogicalStorageId, StorageTarget } from "@/lib/storage/contracts";
import { StorageError } from "@/lib/storage/contracts";
import type { StorageRuntimeConfig } from "@/lib/storage/runtime-config";

const LOGICAL_STORAGES = ["documentos"] as const satisfies readonly LogicalStorageId[];

export function listLogicalStorages(): readonly LogicalStorageId[] {
  return LOGICAL_STORAGES;
}

export function resolveStorageTarget(logicalStorage: string, config: StorageRuntimeConfig): StorageTarget {
  if (!LOGICAL_STORAGES.includes(logicalStorage as LogicalStorageId)) {
    throw new StorageError("CONFIG_INVALID", "Unknown logical storage");
  }

  return {
    logicalStorage: logicalStorage as LogicalStorageId,
    primaryProvider: "quobjects",
    fallbackProvider: "vercel-blob",
    storageSpace: config.storageSpace,
    bucket: config.bucket,
    fallbackStore: config.fallbackStore,
  };
}
