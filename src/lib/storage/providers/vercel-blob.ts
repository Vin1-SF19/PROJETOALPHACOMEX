import "server-only";

import {
  completeMultipartUpload,
  createMultipartUpload,
  del,
  get,
  head,
  list,
  uploadPart,
} from "@vercel/blob";

import type {
  StartMultipartInput,
  StorageCompletedPart,
  StorageDiagnostic,
  StorageMultipartSession,
  StorageObjectMetadata,
  StorageProvider,
  StorageTarget,
} from "@/lib/storage/contracts";
import { StorageError } from "@/lib/storage/contracts";
import type { StorageRuntimeConfig } from "@/lib/storage/runtime-config";
import { classifyStorageError } from "@/lib/storage/sanitize";

export type BlobSdk = {
  list: typeof list;
  createMultipartUpload: typeof createMultipartUpload;
  uploadPart: typeof uploadPart;
  completeMultipartUpload: typeof completeMultipartUpload;
  head: typeof head;
  get: typeof get;
  del: typeof del;
};

const defaultSdk: BlobSdk = { list, createMultipartUpload, uploadPart, completeMultipartUpload, head, get, del };

export class VercelBlobProvider implements StorageProvider {
  readonly id = "vercel-blob" as const;

  constructor(
    private readonly config: StorageRuntimeConfig,
    private readonly sdk: BlobSdk = defaultSdk,
  ) {}

  private commonOptions(signal?: AbortSignal) {
    return {
      access: this.config.blobAccess,
      token: this.config.blobToken,
      abortSignal: signal,
    } as const;
  }

  async diagnose(_target: StorageTarget, signal?: AbortSignal): Promise<StorageDiagnostic> {
    const startedAt = Date.now();
    try {
      await this.sdk.list({ token: this.config.blobToken, limit: 1, abortSignal: signal });
      return { ok: true, provider: this.id, latencyMs: Date.now() - startedAt };
    } catch (error) {
      const classified = classifyStorageError(error, this.id);
      return {
        ok: false,
        provider: this.id,
        latencyMs: Date.now() - startedAt,
        errorCode: classified.code,
      };
    }
  }

  async startMultipart(input: StartMultipartInput, signal?: AbortSignal): Promise<StorageMultipartSession> {
    try {
      const result = await this.sdk.createMultipartUpload(input.objectKey, {
        ...this.commonOptions(signal),
        contentType: input.contentType,
        addRandomSuffix: false,
        allowOverwrite: false,
      });
      return {
        provider: this.id,
        logicalStorage: input.target.logicalStorage,
        bucketOrStore: input.target.fallbackStore,
        objectKey: input.objectKey,
        uploadId: result.uploadId,
        providerKey: result.key,
        contentType: input.contentType,
      };
    } catch (error) {
      throw classifyStorageError(error, this.id);
    }
  }

  async uploadPart(
    session: StorageMultipartSession,
    partNumber: number,
    body: Uint8Array,
    signal?: AbortSignal,
  ): Promise<StorageCompletedPart> {
    if (!session.providerKey) throw new StorageError("CONFIG_INVALID", "Blob multipart key is missing", { provider: this.id });
    try {
      const result = await this.sdk.uploadPart(session.objectKey, Buffer.from(body), {
        ...this.commonOptions(signal),
        uploadId: session.uploadId,
        key: session.providerKey,
        partNumber,
      });
      return { partNumber: result.partNumber, etag: result.etag, size: body.byteLength };
    } catch (error) {
      throw classifyStorageError(error, this.id);
    }
  }

  async completeMultipart(
    session: StorageMultipartSession,
    parts: StorageCompletedPart[],
    signal?: AbortSignal,
  ): Promise<StorageObjectMetadata> {
    if (!session.providerKey) throw new StorageError("CONFIG_INVALID", "Blob multipart key is missing", { provider: this.id });
    try {
      const ordered = [...parts].sort((left, right) => left.partNumber - right.partNumber);
      const result = await this.sdk.completeMultipartUpload(
        session.objectKey,
        ordered.map(({ etag, partNumber }) => ({ etag, partNumber })),
        {
          ...this.commonOptions(signal),
          uploadId: session.uploadId,
          key: session.providerKey,
          contentType: session.contentType,
          addRandomSuffix: false,
          allowOverwrite: false,
        },
      );
      return {
        provider: this.id,
        logicalStorage: session.logicalStorage,
        bucketOrStore: session.bucketOrStore,
        objectKey: session.objectKey,
        size: ordered.reduce((total, part) => total + part.size, 0),
        contentType: result.contentType,
        etag: result.etag,
        providerIdentifier: result.pathname,
        url: result.url,
      };
    } catch (error) {
      throw classifyStorageError(error, this.id);
    }
  }

  async abortMultipart(): Promise<void> {
    // @vercel/blob 2.x does not expose a server-side abort-multipart operation.
    // In-flight requests still honor AbortSignal; orphan cleanup remains provider-managed.
  }

  async head(target: StorageTarget, objectKey: string, signal?: AbortSignal): Promise<StorageObjectMetadata> {
    try {
      const result = await this.sdk.head(objectKey, { token: this.config.blobToken, abortSignal: signal });
      return {
        provider: this.id,
        logicalStorage: target.logicalStorage,
        bucketOrStore: target.fallbackStore,
        objectKey,
        size: result.size,
        contentType: result.contentType,
        etag: result.etag,
        providerIdentifier: result.pathname,
        url: result.url,
      };
    } catch (error) {
      throw classifyStorageError(error, this.id);
    }
  }

  async download(target: StorageTarget, objectKey: string, signal?: AbortSignal): Promise<AsyncIterable<Uint8Array>> {
    void target;
    try {
      const result = await this.sdk.get(objectKey, {
        ...this.commonOptions(signal),
        ...(this.config.blobAccess === "private" ? { useCache: false } : {}),
      });
      if (!result || result.statusCode !== 200 || !result.stream) {
        throw new StorageError("OBJECT_NOT_FOUND", "Blob object was not found", { provider: this.id });
      }
      const reader = result.stream.getReader();
      return {
        async *[Symbol.asyncIterator]() {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              yield value;
            }
          } finally {
            reader.releaseLock();
          }
        },
      };
    } catch (error) {
      throw classifyStorageError(error, this.id);
    }
  }

  async createDownloadUrl(target: StorageTarget, objectKey: string): Promise<string> {
    void target;
    const result = await this.sdk.head(objectKey, { token: this.config.blobToken });
    return result.downloadUrl;
  }

  async delete(_target: StorageTarget, objectKey: string, signal?: AbortSignal): Promise<void> {
    try {
      await this.sdk.del(objectKey, { token: this.config.blobToken, abortSignal: signal });
    } catch (error) {
      throw classifyStorageError(error, this.id);
    }
  }
}
