import { describe, expect, it } from "vitest";

import { resolveStorageTarget } from "@/lib/storage/catalog";
import { MIB } from "@/lib/storage/contracts";
import { readStorageRuntimeConfig } from "@/lib/storage/runtime-config";
import { redactText, sanitizedError } from "@/lib/storage/sanitize";
import { validStorageEnv } from "../helpers/storage-fixtures";

describe("Storage Alpha runtime config", () => {
  it("aplica defaults seguros sem expor valores nos erros", () => {
    const result = readStorageRuntimeConfig(validStorageEnv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.partSizeBytes).toBe(64 * MIB);
    expect(result.config.concurrency).toBe(3);
    expect(result.config.timeoutMs).toBe(5_000);
  });

  it("rejeita endpoint sem HTTPS e parte acima de 95 MiB", () => {
    const result = readStorageRuntimeConfig({
      ...validStorageEnv,
      STORAGE_QUOBJECTS_ENDPOINT: "http://storage-poc.alpha-comex.com",
      STORAGE_MULTIPART_PART_SIZE_MIB: "96",
    });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(validStorageEnv.STORAGE_QUOBJECTS_SECRET_ACCESS_KEY);
  });

  it("aceita BLOB_READ_WRITE_TOKEN como compatibilidade legada", () => {
    const result = readStorageRuntimeConfig({
      ...validStorageEnv,
      STORAGE_VERCEL_BLOB_TOKEN: undefined,
      BLOB_READ_WRITE_TOKEN: "legacy-token",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.config.blobToken).toBe("legacy-token");
  });

  it("resolve apenas storages lógicos conhecidos", () => {
    const result = readStorageRuntimeConfig(validStorageEnv);
    if (!result.ok) throw new Error("invalid fixture");
    expect(resolveStorageTarget("documentos", result.config)).toMatchObject({
      bucket: "pa-poc-private",
      primaryProvider: "quobjects",
      fallbackProvider: "vercel-blob",
    });
    expect(() => resolveStorageTarget("desconhecido", result.config)).toThrow("Unknown logical storage");
  });

  it("remove secrets, Authorization e query assinada", () => {
    const raw = "Authorization=Bearer token poc-secret-key https://example.com/file?signature=secret";
    const redacted = redactText(raw, ["poc-secret-key", "token"]);
    expect(redacted).not.toContain("poc-secret-key");
    expect(redacted).not.toContain("signature=secret");
    expect(JSON.stringify(sanitizedError(new Error(raw), ["poc-secret-key", "token"]))).not.toContain("poc-secret-key");
  });
});
