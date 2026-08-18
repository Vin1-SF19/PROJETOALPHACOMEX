import { describe, expect, it, vi } from "vitest";

import type {
  StartMultipartInput,
  StorageCompletedPart,
  StorageDiagnostic,
  StorageMultipartSession,
  StorageObjectMetadata,
  StorageProvider,
  StorageTarget,
} from "@/lib/storage/contracts";
import { MIB, StorageError } from "@/lib/storage/contracts";
import { checksumStream, selectStorageProvider, uploadMultipart } from "@/lib/storage/orchestrator";
import { deterministicPartSource } from "@/lib/storage/poc";

const target: StorageTarget = {
  logicalStorage: "documentos",
  primaryProvider: "quobjects",
  fallbackProvider: "vercel-blob",
  storageSpace: "painel-alpha-poc",
  bucket: "pa-poc-private",
  fallbackStore: "legacy-default",
};

async function* asAsyncIterable(chunks: Iterable<Uint8Array>): AsyncGenerator<Uint8Array> {
  yield* chunks;
}

class FakeProvider implements StorageProvider {
  readonly id;
  readonly uploaded: Uint8Array[] = [];
  aborted = false;
  diagnoseResult: StorageDiagnostic;
  failPartOnce?: number;

  constructor(id: "quobjects" | "vercel-blob", healthy = true) {
    this.id = id;
    this.diagnoseResult = { ok: healthy, provider: id, latencyMs: 1, errorCode: healthy ? undefined : "NETWORK_ERROR" };
  }

  async diagnose(): Promise<StorageDiagnostic> { return this.diagnoseResult; }
  async startMultipart(input: StartMultipartInput): Promise<StorageMultipartSession> {
    return {
      provider: this.id,
      logicalStorage: input.target.logicalStorage,
      bucketOrStore: this.id === "quobjects" ? input.target.bucket : input.target.fallbackStore,
      objectKey: input.objectKey,
      uploadId: "upload-1",
      providerKey: "provider-key",
      contentType: input.contentType,
    };
  }
  async uploadPart(_session: StorageMultipartSession, partNumber: number, body: Uint8Array): Promise<StorageCompletedPart> {
    if (this.failPartOnce === partNumber) {
      this.failPartOnce = undefined;
      throw new StorageError("PART_FAILED", "transient", { provider: this.id, retryable: true });
    }
    this.uploaded[partNumber - 1] = body;
    return { partNumber, etag: `etag-${partNumber}`, size: body.byteLength };
  }
  async completeMultipart(session: StorageMultipartSession, parts: StorageCompletedPart[]): Promise<StorageObjectMetadata> {
    return {
      provider: this.id,
      logicalStorage: session.logicalStorage,
      bucketOrStore: session.bucketOrStore,
      objectKey: session.objectKey,
      size: parts.reduce((total, part) => total + part.size, 0),
      contentType: session.contentType,
    };
  }
  async abortMultipart(): Promise<void> { this.aborted = true; }
  async head(): Promise<StorageObjectMetadata> { throw new Error("not needed"); }
  async download(): Promise<AsyncIterable<Uint8Array>> { return asAsyncIterable(this.uploaded); }
  async createDownloadUrl(): Promise<string> { return "https://example.test/download"; }
  async delete(): Promise<void> {}
}

describe("Storage Alpha orchestrator", () => {
  it("mantém o primário quando saudável", async () => {
    const primary = new FakeProvider("quobjects", true);
    const fallback = new FakeProvider("vercel-blob", true);
    await expect(selectStorageProvider({ primary, fallback }, target, 100)).resolves.toMatchObject({
      selected: "quobjects",
      reason: "PRIMARY_HEALTHY",
    });
  });

  it("seleciona fallback somente no preflight", async () => {
    const primary = new FakeProvider("quobjects", false);
    const fallback = new FakeProvider("vercel-blob", true);
    await expect(selectStorageProvider({ primary, fallback }, target, 100)).resolves.toMatchObject({
      selected: "vercel-blob",
      reason: "PRIMARY_UNAVAILABLE",
    });
  });

  it("seleciona fallback quando o primário lança ou ignora o timeout", async () => {
    const throwing = new FakeProvider("quobjects");
    vi.spyOn(throwing, "diagnose").mockRejectedValue(new Error("socket failed"));
    const fallback = new FakeProvider("vercel-blob", true);
    await expect(selectStorageProvider({ primary: throwing, fallback }, target, 10)).resolves.toMatchObject({
      selected: "vercel-blob",
    });

    const hanging = new FakeProvider("quobjects");
    vi.spyOn(hanging, "diagnose").mockImplementation(() => new Promise(() => {}));
    await expect(selectStorageProvider({ primary: hanging, fallback }, target, 1)).resolves.toMatchObject({
      selected: "vercel-blob",
    });
  });

  it("faz multipart com retry limitado e checksum sem buffer integral", async () => {
    const provider = new FakeProvider("quobjects");
    provider.failPartOnce = 2;
    const result = await uploadMultipart({
      provider,
      target,
      objectKey: "storage-alpha-poc/test.bin",
      contentType: "application/octet-stream",
      size: 11 * MIB,
      partSize: 5 * MIB,
      concurrency: 2,
      maxRetries: 1,
      source: deterministicPartSource(11 * MIB, 5 * MIB),
    });
    expect(result.parts).toBe(3);
    expect(result.metadata.size).toBe(11 * MIB);
    expect(result.checksum).toHaveLength(64);
    expect(provider.aborted).toBe(false);
    expect((await checksumStream(asAsyncIterable(provider.uploaded))).checksum).toBe(result.checksum);
  });

  it("cancela a sessão após falha definitiva e não troca de provider", async () => {
    const provider = new FakeProvider("quobjects");
    vi.spyOn(provider, "uploadPart").mockRejectedValue(new StorageError("PART_FAILED", "fatal"));
    await expect(uploadMultipart({
      provider,
      target,
      objectKey: "storage-alpha-poc/test.bin",
      contentType: "application/octet-stream",
      size: 5 * MIB,
      partSize: 5 * MIB,
      concurrency: 1,
      maxRetries: 3,
      source: deterministicPartSource(5 * MIB, 5 * MIB),
    })).rejects.toThrow("fatal");
    expect(provider.aborted).toBe(true);
  });

  it("rejeita fonte maior que o tamanho declarado", async () => {
    const provider = new FakeProvider("quobjects");
    await expect(uploadMultipart({
      provider,
      target,
      objectKey: "test.bin",
      contentType: "application/octet-stream",
      size: 5 * MIB,
      partSize: 5 * MIB,
      concurrency: 1,
      maxRetries: 0,
      source: deterministicPartSource(6 * MIB, 5 * MIB),
    })).rejects.toThrow("Source exceeded declared object size");
    expect(provider.aborted).toBe(true);
  });
});
