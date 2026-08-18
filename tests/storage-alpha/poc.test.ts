import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type {
  StartMultipartInput,
  StorageCompletedPart,
  StorageDiagnostic,
  StorageMultipartSession,
  StorageObjectMetadata,
  StorageProvider,
  StorageTarget,
} from "@/lib/storage/contracts";
import { MIB } from "@/lib/storage/contracts";
import { parseStorageSize, runStoragePoc } from "@/lib/storage/poc";
import { validStorageEnv } from "../helpers/storage-fixtures";

class MemoryProvider implements StorageProvider {
  readonly id;
  healthy: boolean;
  deleted = false;
  corruptDownload = false;
  private chunks: Uint8Array[] = [];
  private session?: StorageMultipartSession;

  constructor(id: "quobjects" | "vercel-blob", healthy = true) {
    this.id = id;
    this.healthy = healthy;
  }

  async diagnose(): Promise<StorageDiagnostic> {
    return { ok: this.healthy, provider: this.id, latencyMs: 1, errorCode: this.healthy ? undefined : "NETWORK_ERROR" };
  }
  async startMultipart(input: StartMultipartInput): Promise<StorageMultipartSession> {
    this.session = {
      provider: this.id,
      logicalStorage: input.target.logicalStorage,
      bucketOrStore: this.id === "quobjects" ? input.target.bucket : input.target.fallbackStore,
      objectKey: input.objectKey,
      uploadId: "memory-upload",
      providerKey: "memory-key",
      contentType: input.contentType,
    };
    return this.session;
  }
  async uploadPart(_session: StorageMultipartSession, partNumber: number, body: Uint8Array): Promise<StorageCompletedPart> {
    this.chunks[partNumber - 1] = Uint8Array.from(body);
    return { partNumber, etag: `etag-${partNumber}`, size: body.byteLength };
  }
  async completeMultipart(session: StorageMultipartSession): Promise<StorageObjectMetadata> {
    return {
      provider: this.id,
      logicalStorage: session.logicalStorage,
      bucketOrStore: session.bucketOrStore,
      objectKey: session.objectKey,
      size: this.chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0),
      contentType: session.contentType,
    };
  }
  async abortMultipart(): Promise<void> {}
  async head(target: StorageTarget, objectKey: string): Promise<StorageObjectMetadata> {
    return {
      provider: this.id,
      logicalStorage: target.logicalStorage,
      bucketOrStore: this.id === "quobjects" ? target.bucket : target.fallbackStore,
      objectKey,
      size: this.chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0),
      contentType: "application/octet-stream",
    };
  }
  async download(): Promise<AsyncIterable<Uint8Array>> {
    const chunks = this.chunks;
    const corrupt = this.corruptDownload;
    return {
      async *[Symbol.asyncIterator]() {
        for (let index = 0; index < chunks.length; index += 1) {
          const chunk = Uint8Array.from(chunks[index]);
          if (corrupt && index === 0) chunk[0] ^= 0xff;
          yield chunk;
        }
      },
    };
  }
  async createDownloadUrl(): Promise<string> { return "https://example.test/download"; }
  async delete(): Promise<void> { this.deleted = true; }
}

const pocEnv = {
  ...validStorageEnv,
  STORAGE_MULTIPART_PART_SIZE_MIB: "5",
  STORAGE_MULTIPART_CONCURRENCY: "2",
};

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("storage:poc", () => {
  it("aceita exatamente 2 GiB e rejeita qualquer tamanho maior", () => {
    expect(parseStorageSize("2GiB")).toBe(2 * 1024 * MIB);
    expect(() => parseStorageSize("2.01GiB")).toThrow("between 1 byte and 2 GiB");
  });

  it("bloqueia qualquer escrita sem flags de segurança", async () => {
    const primary = new MemoryProvider("quobjects");
    const fallback = new MemoryProvider("vercel-blob");
    const result = await runStoragePoc(
      { execute: false, confirm: "", provider: "auto", size: 6 * MIB },
      { env: pocEnv, providers: { primary, fallback } },
    );
    expect(result).toMatchObject({ ok: false, code: 2 });
    expect(primary.deleted).toBe(false);
  });

  it("verifica checksum e remove somente o objeto criado", async () => {
    const primary = new MemoryProvider("quobjects");
    const fallback = new MemoryProvider("vercel-blob");
    const result = await runStoragePoc(
      { execute: true, confirm: "storage-alpha-poc", provider: "quobjects", size: 6 * MIB },
      { env: pocEnv, providers: { primary, fallback }, now: () => new Date("2026-08-18T12:00:00.000Z") },
    );
    expect(result).toMatchObject({
      ok: true,
      code: 0,
      checks: { upload: { provider: "quobjects", bytes: 6 * MIB, parts: 2, checksumVerified: true } },
    });
    expect(primary.deleted).toBe(true);
    expect(fallback.deleted).toBe(false);
  });

  it("seleciona Blob quando o primário falha no preflight", async () => {
    const primary = new MemoryProvider("quobjects", false);
    const fallback = new MemoryProvider("vercel-blob", true);
    const result = await runStoragePoc(
      { execute: true, confirm: "storage-alpha-poc", provider: "auto", size: 5 * MIB },
      { env: pocEnv, providers: { primary, fallback } },
    );
    expect(result).toMatchObject({ ok: true, checks: { upload: { provider: "vercel-blob" } } });
    expect(fallback.deleted).toBe(true);
  });

  it("detecta corrupção e ainda limpa o objeto concluído", async () => {
    const primary = new MemoryProvider("quobjects");
    primary.corruptDownload = true;
    const result = await runStoragePoc(
      { execute: true, confirm: "storage-alpha-poc", provider: "quobjects", size: 5 * MIB },
      { env: pocEnv, providers: { primary, fallback: new MemoryProvider("vercel-blob") } },
    );
    expect(result).toMatchObject({
      ok: false,
      code: 1,
      checks: { upload: { errorCode: "CHECKSUM_MISMATCH", cleanupSucceeded: true } },
    });
    expect(primary.deleted).toBe(true);
  });

  it("não sobrescreve evidência existente e mantém a limpeza", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "storage-evidence-"));
    temporaryDirectories.push(directory);
    const evidenceFile = path.join(directory, "result.json");
    writeFileSync(evidenceFile, "existing");
    const primary = new MemoryProvider("quobjects");
    const result = await runStoragePoc(
      {
        execute: true,
        confirm: "storage-alpha-poc",
        provider: "quobjects",
        size: 5 * MIB,
        evidenceFile,
      },
      { env: pocEnv, providers: { primary, fallback: new MemoryProvider("vercel-blob") } },
    );
    expect(result).toMatchObject({ ok: false, code: 2, checks: { evidence: { errorCode: "EVIDENCE_WRITE_FAILED" } } });
    expect(primary.deleted).toBe(true);
  });
});
