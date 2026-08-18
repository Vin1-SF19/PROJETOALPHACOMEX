import "server-only";

import type { StorageCommandResult, StorageDiagnostic, StorageProvider, StorageTarget } from "@/lib/storage/contracts";
import { resolveStorageTarget } from "@/lib/storage/catalog";
import { QuObjectsProvider } from "@/lib/storage/providers/quobjects";
import { VercelBlobProvider } from "@/lib/storage/providers/vercel-blob";
import {
  readStorageRuntimeConfig,
  type StorageEnvironment,
  type StorageRuntimeConfig,
} from "@/lib/storage/runtime-config";

interface StorageDoctorDependencies {
  env?: StorageEnvironment;
  now?: () => Date;
  providers?: { primary: StorageProvider; fallback: StorageProvider };
  createProviders?: (config: StorageRuntimeConfig) => { primary: StorageProvider; fallback: StorageProvider };
}

function actualProviders(config: StorageRuntimeConfig) {
  return {
    primary: new QuObjectsProvider(config),
    fallback: new VercelBlobProvider(config),
  };
}

async function safeDiagnose(
  provider: StorageProvider,
  target: StorageTarget,
  signal: AbortSignal,
): Promise<StorageDiagnostic> {
  const startedAt = Date.now();
  try {
    return await provider.diagnose(target, signal);
  } catch {
    return {
      ok: false,
      provider: provider.id,
      latencyMs: Date.now() - startedAt,
      errorCode: signal.aborted ? "TIMEOUT" : "NETWORK_ERROR",
    };
  }
}

export async function runStorageDoctor(
  dependencies: StorageDoctorDependencies = {},
): Promise<StorageCommandResult> {
  const timestamp = (dependencies.now?.() ?? new Date()).toISOString();
  const runtime = readStorageRuntimeConfig(dependencies.env);
  if (!runtime.ok) {
    return {
      ok: false,
      command: "doctor",
      code: 2,
      checks: {
        config: { ok: false, issues: runtime.issues },
        quobjects: { ok: false, skipped: true },
        vercelBlob: { ok: false, skipped: true },
      },
      timestamp,
    };
  }

  const config = runtime.config;
  const target = resolveStorageTarget("documentos", config);
  const providers = dependencies.providers ?? dependencies.createProviders?.(config) ?? actualProviders(config);
  const quobjectsController = new AbortController();
  const fallbackController = new AbortController();
  const quobjectsTimer = setTimeout(() => quobjectsController.abort(), config.timeoutMs);
  const fallbackTimer = setTimeout(() => fallbackController.abort(), config.timeoutMs);

  try {
    const [primary, fallback] = await Promise.all([
      safeDiagnose(providers.primary, target, quobjectsController.signal),
      safeDiagnose(providers.fallback, target, fallbackController.signal),
    ]);
    const ok = primary.ok && fallback.ok;
    return {
      ok,
      command: "doctor",
      code: ok ? 0 : 1,
      checks: {
        config: {
          ok: true,
          publicHost: new URL(config.publicEndpoint).hostname,
          internalEndpointConfigured: Boolean(config.internalEndpoint),
          bucket: config.bucket,
          storageSpace: config.storageSpace,
          fallbackStore: config.fallbackStore,
          partSizeMiB: config.partSizeBytes / (1024 * 1024),
          concurrency: config.concurrency,
        },
        quobjects: primary,
        vercelBlob: fallback,
      },
      timestamp,
    };
  } finally {
    clearTimeout(quobjectsTimer);
    clearTimeout(fallbackTimer);
  }
}
