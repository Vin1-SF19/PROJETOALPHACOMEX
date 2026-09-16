import { describe, expect, it, vi } from "vitest";

import {
  VercelBlobProvider,
  type BlobSdk,
} from "@/lib/storage/providers/vercel-blob";
import { readStorageRuntimeConfig } from "@/lib/storage/runtime-config";
import { validStorageEnv } from "../helpers/storage-fixtures";

function runtimeConfig(access: "public" | "private") {
  const result = readStorageRuntimeConfig({
    ...validStorageEnv,
    STORAGE_VERCEL_ACCESS: access,
  });
  if (!result.ok) throw new Error("invalid test storage config");
  return result.config;
}

function sdkWithReadableBlob() {
  const get = vi.fn().mockResolvedValue({
    statusCode: 200,
    stream: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1]));
        controller.close();
      },
    }),
  });
  const unused = vi.fn();
  return {
    get,
    sdk: {
      list: unused,
      createMultipartUpload: unused,
      uploadPart: unused,
      completeMultipartUpload: unused,
      head: unused,
      get,
      del: unused,
      copy: unused,
      issueSignedToken: unused,
      presignUrl: unused,
    } as unknown as BlobSdk,
  };
}

describe("Vercel Blob provider", () => {
  it("nao envia useCache=false para store publico", async () => {
    const { get, sdk } = sdkWithReadableBlob();
    const provider = new VercelBlobProvider(runtimeConfig("public"), sdk);

    const stream = await provider.download({} as never, "object.bin");
    for await (const chunk of stream) expect(chunk).toEqual(new Uint8Array([1]));

    expect(get.mock.calls[0]?.[1]).not.toHaveProperty("useCache");
  });

  it("desabilita cache somente para store privado", async () => {
    const { get, sdk } = sdkWithReadableBlob();
    const provider = new VercelBlobProvider(runtimeConfig("private"), sdk);

    const stream = await provider.download({} as never, "object.bin");
    for await (const chunk of stream) expect(chunk).toEqual(new Uint8Array([1]));

    expect(get.mock.calls[0]?.[1]).toMatchObject({ useCache: false, access: "private" });
  });

  it("lista em modo folded com cursor e limite controlado", async () => {
    const list = vi.fn().mockResolvedValue({ blobs: [{ pathname: "rh/a.pdf", size: 10, uploadedAt: new Date(), etag: "e" }], folders: ["rh/2026/"], hasMore: true, cursor: "next" });
    const unused = vi.fn();
    const sdk = { list, createMultipartUpload: unused, uploadPart: unused, completeMultipartUpload: unused, head: unused, get: unused, del: unused, copy: unused, issueSignedToken: unused, presignUrl: unused } as unknown as BlobSdk;
    const provider = new VercelBlobProvider(runtimeConfig("private"), sdk);
    await expect(provider.listObjects({} as never, "rh/", undefined, 20)).resolves.toMatchObject({ prefixes: ["rh/2026/"], continuationToken: "next" });
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ prefix: "rh/", mode: "folded", limit: 20 }));
  });

  it("gera URL GET curta e restrita para store privado", async () => {
    const issueSignedToken = vi.fn().mockResolvedValue({
      clientSigningToken: "client-signing-token",
      delegationToken: "delegation-token",
      validUntil: Date.now() + 120_000,
    });
    const presignUrl = vi.fn().mockResolvedValue({ presignedUrl: "https://example.private.blob.vercel-storage.com/object.bin?signed=true" });
    const unused = vi.fn();
    const sdk = { list: unused, createMultipartUpload: unused, uploadPart: unused, completeMultipartUpload: unused, head: unused, get: unused, del: unused, copy: unused, issueSignedToken, presignUrl } as unknown as BlobSdk;
    const provider = new VercelBlobProvider(runtimeConfig("private"), sdk);

    await expect(provider.createDownloadUrl({} as never, "object.bin", 120)).resolves.toContain("signed=true");
    expect(issueSignedToken).toHaveBeenCalledWith(expect.objectContaining({ pathname: "object.bin", operations: ["get"] }));
    expect(presignUrl).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ access: "private", operation: "get", pathname: "object.bin", useCache: false }));
  });
});
