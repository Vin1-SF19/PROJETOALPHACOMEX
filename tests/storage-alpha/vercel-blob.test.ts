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
});
