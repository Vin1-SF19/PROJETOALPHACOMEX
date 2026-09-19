import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  DEFAULT_INVENTORY_IMAGE_MAX_BYTES,
  getInventoryImageMaxBytes,
  hasValidInventoryImageSignature,
  inventoryImageObjectKey,
  isOptimizableInventoryImage,
  validateInventoryImageMetadata,
} from "@/lib/estoque/images";
import { INVENTORY_IMAGE_MAX_DIMENSION, prepareInventoryImageForStorage } from "@/lib/estoque/images-server";

describe("estoque image validation", () => {
  it.each([
    ["produto.jpg", "image/jpeg"],
    ["produto.jpeg", "image/jpeg"],
    ["produto.png", "image/png"],
    ["produto.webp", "image/webp"],
  ])("aceita extensão e MIME coerentes: %s", (name, type) => {
    expect(validateInventoryImageMetadata({ name, type, size: 1_024 })).toBeNull();
  });

  it("rejeita MIME, extensão divergente, arquivo vazio e excesso de tamanho", () => {
    expect(validateInventoryImageMetadata({ name: "foto.gif", type: "image/gif", size: 100 })).toMatch(/PNG/);
    expect(validateInventoryImageMetadata({ name: "foto.png", type: "image/jpeg", size: 100 })).toMatch(/extensão/);
    expect(validateInventoryImageMetadata({ name: "foto.webp", type: "image/webp", size: 0 })).toMatch(/vazia/);
    expect(validateInventoryImageMetadata({ name: "foto.webp", type: "image/webp", size: DEFAULT_INVENTORY_IMAGE_MAX_BYTES + 1 })).toMatch(/máximo/);
  });

  it("valida magic bytes dos três formatos", () => {
    expect(hasValidInventoryImageSignature("image/jpeg", new Uint8Array([0xff, 0xd8, 0xff]))).toBe(true);
    expect(hasValidInventoryImageSignature("image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(hasValidInventoryImageSignature("image/webp", new TextEncoder().encode("RIFF0000WEBP"))).toBe(true);
    expect(hasValidInventoryImageSignature("image/png", new TextEncoder().encode("not-a-png"))).toBe(false);
  });

  it("usa limite configurado válido e rejeita configuração inválida", () => {
    expect(getInventoryImageMaxBytes("3145728")).toBe(3 * 1024 * 1024);
    expect(getInventoryImageMaxBytes("invalid")).toBe(DEFAULT_INVENTORY_IMAGE_MAX_BYTES);
  });

  it("gera chave confinada ao prefixo do item e sanitiza o identificador", () => {
    expect(inventoryImageObjectKey("item-123", "image/png", "fixed")).toBe("estoque/itens/item-123/fixed.png");
    expect(inventoryImageObjectKey("../../item", "image/webp", "fixed")).toBe("estoque/itens/item/fixed.webp");
    expect(() => inventoryImageObjectKey("../", "image/jpeg", "fixed")).toThrow(/Item inválido/);
    expect(() => inventoryImageObjectKey("item", "image/jpeg", "../")).toThrow(/Identificador inválido/);
  });

  it("só habilita o otimizador Next para imagens do Blob configurado", () => {
    expect(isOptimizableInventoryImage("https://abc.public.blob.vercel-storage.com/estoque/foto.webp")).toBe(true);
    expect(isOptimizableInventoryImage("https://cdn-legado.example.com/foto.jpg")).toBe(false);
    expect(isOptimizableInventoryImage("data:image/png;base64,AAAA")).toBe(false);
  });

  it("decodifica, normaliza em WebP e limita as dimensões no servidor", async () => {
    const source = await sharp({ create: { width: 2_400, height: 1_200, channels: 3, background: "#2563eb" } }).jpeg().toBuffer();
    const prepared = await prepareInventoryImageForStorage(source, "image/jpeg");
    const metadata = await sharp(prepared.bytes).metadata();
    expect(prepared.mimeType).toBe("image/webp");
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(INVENTORY_IMAGE_MAX_DIMENSION);
    expect(metadata.height).toBe(800);
  });

  it("rejeita arquivo indecodificável e formato decodificado divergente", async () => {
    await expect(prepareInventoryImageForStorage(new TextEncoder().encode("not-an-image"), "image/png")).rejects.toThrow(/corrompida/);
    const png = await sharp({ create: { width: 10, height: 10, channels: 4, background: "#00000000" } }).png().toBuffer();
    await expect(prepareInventoryImageForStorage(png, "image/jpeg")).rejects.toThrow(/não corresponde/);
  });
});
