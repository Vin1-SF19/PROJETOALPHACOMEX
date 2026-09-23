import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  del: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), findMany: vi.fn(),
}));
vi.mock("@vercel/blob", () => ({ del: mocks.del }));
vi.mock("@/lib/prisma", () => ({ default: {
  bpmCardHistorico: { findUnique: mocks.findUnique, updateMany: mocks.updateMany, findMany: mocks.findMany },
  bpmCardAnexo: { findFirst: mocks.findFirst },
} }));

import { limparBlobAnexoPendente, reconciliarBlobsAnexosBpm } from "@/lib/bpm/anexos-lifecycle";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findUnique.mockResolvedValue({ id: "h1", cardId: "c1", acao: "ANEXO_BLOB_LIMPEZA_PENDENTE", valorAnteriorJson: "bpm-blob:bpm/c1/arquivo.pdf", createdAt: new Date(0) });
  mocks.findFirst.mockResolvedValue(null);
  mocks.del.mockResolvedValue(undefined);
  mocks.updateMany.mockResolvedValue({ count: 1 });
});

it("apaga Blob após commit e conclui pendência", async () => {
  expect(await limparBlobAnexoPendente("h1")).toBe(true);
  expect(mocks.del).toHaveBeenCalledWith("bpm/c1/arquivo.pdf", expect.any(Object));
  expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { acao: "ANEXO_BLOB_LIMPEZA_CONCLUIDA" } }));
});

it("falha no storage mantém pendência para retry", async () => {
  mocks.del.mockRejectedValueOnce(new Error("storage indisponível"));
  await expect(limparBlobAnexoPendente("h1")).rejects.toThrow("storage indisponível");
  expect(mocks.updateMany).not.toHaveBeenCalled();
  expect(await limparBlobAnexoPendente("h1")).toBe(true);
});

it("upload sem metadado só é removido após 24 horas; vínculo criado impede exclusão", async () => {
  mocks.findUnique.mockResolvedValueOnce({ id: "h1", cardId: "c1", acao: "ANEXO_UPLOAD_SEM_REGISTRO", valorAnteriorJson: "bpm-blob:bpm/c1/arquivo.pdf", createdAt: new Date() });
  expect(await limparBlobAnexoPendente("h1")).toBe(false);
  expect(mocks.del).not.toHaveBeenCalled();
  mocks.findUnique.mockResolvedValueOnce({ id: "h1", cardId: "c1", acao: "ANEXO_UPLOAD_SEM_REGISTRO", valorAnteriorJson: "bpm-blob:bpm/c1/arquivo.pdf", createdAt: new Date(0) });
  mocks.findFirst.mockResolvedValueOnce({ id: "anexo" });
  expect(await limparBlobAnexoPendente("h1")).toBe(true);
  expect(mocks.del).not.toHaveBeenCalled();
});

it("cron continua lote quando um Blob falha", async () => {
  mocks.findMany.mockResolvedValue([{ id: "h1" }, { id: "h2" }]);
  mocks.del.mockRejectedValueOnce(new Error("falha temporária"));
  expect(await reconciliarBlobsAnexosBpm()).toEqual({ examinados: 2, concluidos: 1, falhas: 1 });
});
