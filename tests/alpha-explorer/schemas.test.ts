import { describe, expect, it } from "vitest";

import { initiateUploadSchema, itemActionSchema, signPartsSchema } from "@/lib/alpha-explorer/schemas";
import { STORAGE_MAX_OBJECT_SIZE } from "@/lib/storage/contracts";

describe("Alpha Explorer external schemas", () => {
  it("aceita exatamente 2 GiB e rejeita zero ou acima do limite", () => {
    const base = { path: "financeiro", name: "arquivo.bin", mime: "application/octet-stream" };
    expect(initiateUploadSchema.safeParse({ ...base, size: STORAGE_MAX_OBJECT_SIZE }).success).toBe(true);
    expect(initiateUploadSchema.safeParse({ ...base, size: 0 }).success).toBe(false);
    expect(initiateUploadSchema.safeParse({ ...base, size: STORAGE_MAX_OBJECT_SIZE + 1 }).success).toBe(false);
  });

  it("limita a janela de assinatura e recusa campos externos", () => {
    expect(signPartsSchema.safeParse({ partNumbers: [1, 2, 3, 4] }).success).toBe(true);
    expect(signPartsSchema.safeParse({ partNumbers: [1, 2, 3, 4, 5] }).success).toBe(false);
    expect(signPartsSchema.safeParse({ partNumbers: [1], objectKey: "forjado" }).success).toBe(false);
  });

  it("exige versão otimista nas operações destrutivas", () => {
    expect(itemActionSchema.safeParse({ action: "delete", version: 2 }).success).toBe(true);
    expect(itemActionSchema.safeParse({ action: "delete" }).success).toBe(false);
  });
});
