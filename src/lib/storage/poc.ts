import "server-only";

import { createReadStream, mkdirSync, statSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";

import { resolveStorageTarget } from "@/lib/storage/catalog";
import {
  GIB,
  MIB,
  STORAGE_MAX_OBJECT_SIZE,
  StorageError,
  type StorageCommandResult,
  type StorageProvider,
} from "@/lib/storage/contracts";
import { checksumStream, selectStorageProvider, uploadMultipart } from "@/lib/storage/orchestrator";
import { QuObjectsProvider } from "@/lib/storage/providers/quobjects";
import { VercelBlobProvider } from "@/lib/storage/providers/vercel-blob";
import {
  readStorageRuntimeConfig,
  storageSecretValues,
  type StorageEnvironment,
} from "@/lib/storage/runtime-config";
import { sanitizedError } from "@/lib/storage/sanitize";

export type PocProviderChoice = "auto" | "quobjects" | "vercel-blob";

export interface StoragePocOptions {
  execute: boolean;
  confirm: string;
  provider: PocProviderChoice;
  size: number;
  file?: string;
  evidenceFile?: string;
}

interface StoragePocDependencies {
  env?: StorageEnvironment;
  now?: () => Date;
  providers?: { primary: StorageProvider; fallback: StorageProvider };
}

export function parseStorageSize(value: string): number {
  const match = /^(\d+(?:\.\d+)?)(b|mib|mb|gib|gb)$/i.exec(value.trim());
  if (!match) throw new StorageError("SIZE_INVALID", "Use a size such as 10MiB or 2GiB");
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = unit === "b" ? 1 : unit === "mib" ? MIB : unit === "mb" ? 1_000_000 : unit === "gib" ? GIB : 1_000_000_000;
  const size = Math.floor(amount * multiplier);
  if (!Number.isSafeInteger(size) || size <= 0 || size > STORAGE_MAX_OBJECT_SIZE) {
    throw new StorageError("SIZE_INVALID", "POC size must be between 1 byte and 2 GiB");
  }
  return size;
}

export async function* deterministicPartSource(totalSize: number, partSize: number): AsyncGenerator<Uint8Array> {
  let offset = 0;
  let partNumber = 1;
  while (offset < totalSize) {
    const currentSize = Math.min(partSize, totalSize - offset);
    const body = Buffer.allocUnsafe(currentSize);
    body.fill(partNumber % 251);
    yield body;
    offset += currentSize;
    partNumber += 1;
  }
}

function filePartSource(file: string, partSize: number): AsyncIterable<Uint8Array> {
  return createReadStream(file, { highWaterMark: partSize }) as AsyncIterable<Uint8Array>;
}

function writeEvidence(file: string | undefined, result: StorageCommandResult): boolean {
  if (!file) return true;
  try {
    const absolute = path.resolve(file);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, `${JSON.stringify(result, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    return true;
  } catch {
    return false;
  }
}

export async function runStoragePoc(
  options: StoragePocOptions,
  dependencies: StoragePocDependencies = {},
): Promise<StorageCommandResult> {
  const now = dependencies.now ?? (() => new Date());
  const timestamp = now().toISOString();
  if (!options.execute || options.confirm !== "storage-alpha-poc") {
    return {
      ok: false,
      command: "poc",
      code: 2,
      checks: { safety: { ok: false, errorCode: "EXPLICIT_CONFIRMATION_REQUIRED" } },
      timestamp,
    };
  }

  const runtime = readStorageRuntimeConfig(dependencies.env);
  if (!runtime.ok) {
    return { ok: false, command: "poc", code: 2, checks: { config: { ok: false, issues: runtime.issues } }, timestamp };
  }

  const config = runtime.config;
  const target = resolveStorageTarget("documentos", config);
  const providers = dependencies.providers ?? {
    primary: new QuObjectsProvider(config),
    fallback: new VercelBlobProvider(config),
  };
  let size: number;
  try {
    size = options.file ? statSync(options.file).size : options.size;
  } catch {
    return { ok: false, command: "poc", code: 2, checks: { input: { ok: false, errorCode: "FILE_NOT_FOUND" } }, timestamp };
  }
  if (size <= 0 || size > STORAGE_MAX_OBJECT_SIZE) {
    return { ok: false, command: "poc", code: 2, checks: { input: { ok: false, errorCode: "SIZE_INVALID" } }, timestamp };
  }

  const key = `storage-alpha-poc/${timestamp.replaceAll(/[:.]/g, "-")}-${randomUUID()}.bin`;
  const startedAt = Date.now();
  let completed = false;
  let selection: Awaited<ReturnType<typeof selectStorageProvider>> | undefined;

  try {
    selection = options.provider === "auto"
      ? await selectStorageProvider(providers, target, config.timeoutMs)
      : {
          provider: options.provider === "quobjects" ? providers.primary : providers.fallback,
          selected: options.provider,
          reason: "EXPLICIT" as const,
        };
    const source = options.file
      ? filePartSource(options.file, config.partSizeBytes)
      : deterministicPartSource(size, config.partSizeBytes);
    const uploaded = await uploadMultipart({
      provider: selection.provider,
      target,
      objectKey: key,
      contentType: "application/octet-stream",
      size,
      partSize: config.partSizeBytes,
      concurrency: config.concurrency,
      maxRetries: config.maxRetries,
      source,
    });
    completed = true;
    const head = await selection.provider.head(target, key);
    const downloaded = await checksumStream(await selection.provider.download(target, key));
    if (head.size !== size || downloaded.size !== size || downloaded.checksum !== uploaded.checksum) {
      throw new StorageError("CHECKSUM_MISMATCH", "Uploaded object failed integrity verification", {
        provider: selection.provider.id,
      });
    }

    try {
      await selection.provider.delete(target, key);
      completed = false;
    } catch (error) {
      throw new StorageError("HTTP_ERROR", "POC object verification passed but cleanup failed", {
        provider: selection.provider.id,
        cause: error,
      });
    }

    const durationMs = Date.now() - startedAt;
    const result: StorageCommandResult = {
      ok: true,
      command: "poc",
      code: 0,
      checks: {
        safety: { ok: true, isolatedKey: true, cleanupSucceeded: true },
        upload: {
          ok: true,
          provider: selection.selected,
          selectionReason: selection.reason,
          bytes: size,
          parts: uploaded.parts,
          checksumVerified: true,
          durationMs,
          throughputMiBPerSecond: durationMs === 0 ? null : Number(((size / MIB) / (durationMs / 1_000)).toFixed(2)),
        },
      },
      timestamp,
    };
    if (writeEvidence(options.evidenceFile, result)) return result;
    return {
      ...result,
      ok: false,
      code: 2,
      checks: { ...result.checks, evidence: { ok: false, errorCode: "EVIDENCE_WRITE_FAILED" } },
    };
  } catch (error) {
    let cleanupSucceeded: boolean | null = null;
    if (completed && selection) {
      try {
        await selection.provider.delete(target, key);
        cleanupSucceeded = true;
        completed = false;
      } catch {
        cleanupSucceeded = false;
      }
    }
    const result: StorageCommandResult = {
      ok: false,
      command: "poc",
      code: error instanceof StorageError && ["CONFIG_INVALID", "SIZE_INVALID"].includes(error.code) ? 2 : 1,
      checks: {
        upload: {
          ok: false,
          provider: selection?.selected ?? options.provider,
          cleanupSucceeded,
          ...sanitizedError(error, storageSecretValues(config)),
        },
      },
      timestamp,
    };
    writeEvidence(options.evidenceFile, result);
    return result;
  }
}
