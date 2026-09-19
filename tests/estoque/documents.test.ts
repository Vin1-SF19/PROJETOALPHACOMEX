import { describe, expect, it } from "vitest";
import {
  DEFAULT_INVENTORY_INVOICE_MAX_BYTES,
  hasValidInventoryInvoiceSignature,
  inventoryInvoiceObjectKey,
  validateInventoryInvoiceMetadata,
} from "@/lib/estoque/documents";

describe("inventory invoice validation", () => {
  it.each([
    ["nota.pdf", "application/pdf"], ["nota.jpg", "image/jpeg"], ["nota.png", "image/png"], ["nota.webp", "image/webp"],
  ])("aceita nota fiscal %s", (name, type) => {
    expect(validateInventoryInvoiceMetadata({ name, type, size: 1024 })).toBeNull();
  });

  it("rejeita extensão divergente, tipo desconhecido e arquivo grande", () => {
    expect(validateInventoryInvoiceMetadata({ name: "nota.jpg", type: "application/pdf", size: 100 })).toMatch(/extensão/);
    expect(validateInventoryInvoiceMetadata({ name: "nota.exe", type: "application/octet-stream", size: 100 })).toMatch(/PDF/);
    expect(validateInventoryInvoiceMetadata({ name: "nota.pdf", type: "application/pdf", size: DEFAULT_INVENTORY_INVOICE_MAX_BYTES + 1 })).toMatch(/8 MB/);
  });

  it("confere assinatura de PDF e gera chave confinada ao item", () => {
    expect(hasValidInventoryInvoiceSignature("application/pdf", new TextEncoder().encode("%PDF-1.7"))).toBe(true);
    expect(hasValidInventoryInvoiceSignature("application/pdf", new TextEncoder().encode("arquivo"))).toBe(false);
    expect(inventoryInvoiceObjectKey("item-1", "application/pdf", "fixed")).toBe("estoque/itens/item-1/notas-fiscais/fixed.pdf");
  });
});
