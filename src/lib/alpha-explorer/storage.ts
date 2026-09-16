import "server-only";

import { resolveStorageTarget } from "@/lib/storage/catalog";
import type { StorageProvider, StorageProviderId } from "@/lib/storage/contracts";
import { QuObjectsProvider } from "@/lib/storage/providers/quobjects";
import { VercelBlobProvider } from "@/lib/storage/providers/vercel-blob";
import { readStorageRuntimeConfig } from "@/lib/storage/runtime-config";

import { ExplorerError } from "./errors";

export function createExplorerStorage() {
  const runtime = readStorageRuntimeConfig();
  if (!runtime.ok) throw new ExplorerError("STORAGE_CONFIG_INVALID", 503, "Armazenamento indisponível");
  const target = resolveStorageTarget("documentos", runtime.config);
  return {
    config: runtime.config,
    target,
    quobjects: new QuObjectsProvider(runtime.config),
    blob: new VercelBlobProvider(runtime.config),
  };
}
export function providerById(storage: ReturnType<typeof createExplorerStorage>, provider: StorageProviderId): StorageProvider {
  return provider === "quobjects" ? storage.quobjects : storage.blob;
}
