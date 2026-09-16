import {
  CopyObjectCommand,
  HeadObjectCommand,
  ListObjectsCommand,
  ListObjectsV2Command,
  ListMultipartUploadsCommand,
  ListPartsCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import {
  QuObjectsProvider,
  type QuObjectsClient,
} from "@/lib/storage/providers/quobjects";
import { readStorageRuntimeConfig } from "@/lib/storage/runtime-config";
import type { StorageMultipartSession } from "@/lib/storage/contracts";
import { validStorageEnv } from "../helpers/storage-fixtures";

const session: StorageMultipartSession = {
  provider: "quobjects",
  logicalStorage: "documentos",
  bucketOrStore: "pa-poc-private",
  objectKey: "storage-alpha-poc/test.bin",
  uploadId: "upload-1",
  contentType: "application/octet-stream",
};

function runtimeConfig() {
  const result = readStorageRuntimeConfig(validStorageEnv);
  if (!result.ok) throw new Error("invalid test storage config");
  return result.config;
}

describe("QuObjects provider", () => {
  it("usa o ETag devolvido diretamente pelo UploadPart", async () => {
    const send = vi.fn().mockResolvedValue({ ETag: '"part-1"' });
    const provider = new QuObjectsProvider(runtimeConfig(), { send } as unknown as QuObjectsClient);

    await expect(provider.uploadPart(session, 1, new Uint8Array(5))).resolves.toEqual({
      partNumber: 1,
      etag: '"part-1"',
      size: 5,
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(UploadPartCommand);
  });

  it("recupera via ListParts o ETag omitido pelo gateway", async () => {
    const send = vi.fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        Parts: [
          { PartNumber: 1, ETag: '"part-1"' },
          { PartNumber: 2, ETag: '"part-2"' },
        ],
      });
    const provider = new QuObjectsProvider(runtimeConfig(), { send } as unknown as QuObjectsClient);

    await expect(provider.uploadPart(session, 2, new Uint8Array(7))).resolves.toEqual({
      partNumber: 2,
      etag: '"part-2"',
      size: 7,
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(ListPartsCommand);
  });

  it("falha de forma controlada quando o NAS nao informa o ETag", async () => {
    const send = vi.fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ Parts: [{ PartNumber: 1 }] });
    const provider = new QuObjectsProvider(runtimeConfig(), { send } as unknown as QuObjectsClient);

    await expect(provider.uploadPart(session, 1, new Uint8Array(5))).rejects.toMatchObject({
      code: "PART_FAILED",
      provider: "quobjects",
    });
  });

  it("consulta a chave exata quando o gateway nega HeadObject", async () => {
    const denied = Object.assign(new Error("denied"), { $metadata: { httpStatusCode: 403 } });
    const send = vi.fn()
      .mockRejectedValueOnce(denied)
      .mockResolvedValueOnce({
        Contents: [{ Key: session.objectKey, Size: 10, ETag: '"object-etag"' }],
      });
    const provider = new QuObjectsProvider(runtimeConfig(), { send } as unknown as QuObjectsClient);

    await expect(provider.head({
      logicalStorage: "documentos",
      primaryProvider: "quobjects",
      fallbackProvider: "vercel-blob",
      storageSpace: "painel-alpha-poc",
      bucket: session.bucketOrStore,
      fallbackStore: "legacy-default",
    }, session.objectKey)).resolves.toMatchObject({
      size: 10,
      etag: '"object-etag"',
    });
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(HeadObjectCommand);
    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(ListObjectsCommand);
  });

  it("pagina objetos e prefixes sem listar o bucket inteiro", async () => {
    const send = vi.fn().mockResolvedValue({
      Contents: [{ Key: "financeiro/a.pdf", Size: 12, ETag: '"a"' }],
      CommonPrefixes: [{ Prefix: "financeiro/2026/" }],
      IsTruncated: true,
      NextContinuationToken: "next",
    });
    const provider = new QuObjectsProvider(runtimeConfig(), { send } as unknown as QuObjectsClient);
    const result = await provider.listObjects({ logicalStorage: "documentos", primaryProvider: "quobjects", fallbackProvider: "vercel-blob", storageSpace: "painel-alpha-poc", bucket: "pa-poc-private", fallbackStore: "legacy-default" }, "financeiro/", undefined, 25);
    expect(result).toMatchObject({ prefixes: ["financeiro/2026/"], continuationToken: "next" });
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(ListObjectsV2Command);
    expect(send.mock.calls[0]?.[0].input).toMatchObject({ Prefix: "financeiro/", Delimiter: "/", MaxKeys: 25 });
  });

  it("lista multipart incompleto e copia antes de confirmar destino", async () => {
    const send = vi.fn()
      .mockResolvedValueOnce({ Uploads: [{ Key: "alpha-explorer/a", UploadId: "u1" }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ ContentLength: 20, ContentType: "application/pdf" });
    const provider = new QuObjectsProvider(runtimeConfig(), { send } as unknown as QuObjectsClient);
    const target = { logicalStorage: "documentos", primaryProvider: "quobjects", fallbackProvider: "vercel-blob", storageSpace: "painel-alpha-poc", bucket: "pa-poc-private", fallbackStore: "legacy-default" } as const;
    await expect(provider.listMultipartUploads(target, "alpha-explorer/")).resolves.toMatchObject({ uploads: [{ uploadId: "u1" }] });
    await expect(provider.copyObject(target, "alpha-explorer/a", "alpha-explorer/b")).resolves.toMatchObject({ size: 20 });
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(ListMultipartUploadsCommand);
    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(CopyObjectCommand);
    expect(send.mock.calls[2]?.[0]).toBeInstanceOf(HeadObjectCommand);
  });
});
