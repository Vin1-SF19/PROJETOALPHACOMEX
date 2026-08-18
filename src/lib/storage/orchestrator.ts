import "server-only";

import { createHash } from "node:crypto";

import type {
  StorageCompletedPart,
  StorageObjectMetadata,
  StorageProvider,
  StorageProviderId,
  StorageTarget,
} from "@/lib/storage/contracts";
import { StorageError, validateObjectSize, validatePartSize } from "@/lib/storage/contracts";

export interface StorageProviderSet {
  primary: StorageProvider;
  fallback: StorageProvider;
}

export interface ProviderSelection {
  provider: StorageProvider;
  selected: StorageProviderId;
  reason: "PRIMARY_HEALTHY" | "PRIMARY_UNAVAILABLE" | "EXPLICIT";
}

function timeoutSignal(timeoutMs: number): { signal: AbortSignal; clear: () => void; timedOut: Promise<void> } {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const timedOut = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve();
    }, timeoutMs);
  });
  return { signal: controller.signal, clear: () => clearTimeout(timer), timedOut };
}

async function diagnoseWithTimeout(
  provider: StorageProvider,
  target: StorageTarget,
  timeoutMs: number,
): Promise<boolean> {
  const timeout = timeoutSignal(timeoutMs);
  try {
    const diagnostic = provider.diagnose(target, timeout.signal)
      .then((result) => result.ok)
      .catch(() => false);
    return await Promise.race([diagnostic, timeout.timedOut.then(() => false)]);
  } finally {
    timeout.clear();
  }
}

export async function selectStorageProvider(
  providers: StorageProviderSet,
  target: StorageTarget,
  timeoutMs: number,
): Promise<ProviderSelection> {
  if (await diagnoseWithTimeout(providers.primary, target, timeoutMs)) {
    return { provider: providers.primary, selected: providers.primary.id, reason: "PRIMARY_HEALTHY" };
  }

  if (!await diagnoseWithTimeout(providers.fallback, target, timeoutMs)) {
    throw new StorageError("NETWORK_ERROR", "Primary and fallback providers are unavailable", {
      provider: providers.fallback.id,
    });
  }
  return { provider: providers.fallback, selected: providers.fallback.id, reason: "PRIMARY_UNAVAILABLE" };
}

async function withRetry<T>(operation: () => Promise<T>, maxRetries: number): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const retryable = error instanceof StorageError ? error.retryable : false;
      if (!retryable || attempt === maxRetries) break;
      await new Promise((resolve) => setTimeout(resolve, Math.min(250 * 2 ** attempt, 2_000)));
    }
  }
  throw lastError;
}

export interface MultipartUploadOptions {
  provider: StorageProvider;
  target: StorageTarget;
  objectKey: string;
  contentType: string;
  size: number;
  partSize: number;
  concurrency: number;
  maxRetries: number;
  source: AsyncIterable<Uint8Array>;
}

export interface MultipartUploadResult {
  metadata: StorageObjectMetadata;
  checksum: string;
  parts: number;
}

export async function uploadMultipart(options: MultipartUploadOptions): Promise<MultipartUploadResult> {
  validateObjectSize(options.size);
  validatePartSize(options.partSize);
  if (!Number.isSafeInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 4) {
    throw new StorageError("CONFIG_INVALID", "Multipart concurrency must be between 1 and 4");
  }

  const session = await options.provider.startMultipart({
    target: options.target,
    objectKey: options.objectKey,
    contentType: options.contentType,
  });
  const checksum = createHash("sha256");
  const completed: StorageCompletedPart[] = [];
  let uploadedBytes = 0;
  let partNumber = 1;
  let batch: Array<{ partNumber: number; body: Uint8Array }> = [];

  const uploadBatch = async () => {
    const results = await Promise.all(batch.map(({ body, partNumber: number }) => withRetry(
      () => options.provider.uploadPart(session, number, body),
      options.maxRetries,
    )));
    completed.push(...results);
    batch = [];
  };

  try {
    for await (const body of options.source) {
      if (body.byteLength === 0) continue;
      if (body.byteLength > options.partSize) {
        throw new StorageError("SIZE_INVALID", "Source yielded a part larger than configured part size");
      }
      uploadedBytes += body.byteLength;
      if (uploadedBytes > options.size) throw new StorageError("SIZE_INVALID", "Source exceeded declared object size");
      checksum.update(body);
      batch.push({ partNumber, body });
      partNumber += 1;
      if (batch.length >= options.concurrency) await uploadBatch();
    }
    if (batch.length > 0) await uploadBatch();
    if (uploadedBytes !== options.size) throw new StorageError("SIZE_INVALID", "Source size differs from declared object size");

    const metadata = await options.provider.completeMultipart(session, completed);
    const checksumValue = checksum.digest("hex");
    return {
      metadata: { ...metadata, checksum: checksumValue },
      checksum: checksumValue,
      parts: completed.length,
    };
  } catch (error) {
    try {
      await options.provider.abortMultipart(session);
    } catch {
      // Preserve the upload failure; abort is best-effort.
    }
    throw error;
  }
}

export async function checksumStream(source: AsyncIterable<Uint8Array>): Promise<{ checksum: string; size: number }> {
  const hash = createHash("sha256");
  let size = 0;
  for await (const chunk of source) {
    hash.update(chunk);
    size += chunk.byteLength;
  }
  return { checksum: hash.digest("hex"), size };
}
