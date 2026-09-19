import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const form = readFileSync(resolve(process.cwd(), "src/components/Estoque/InventoryItemForm.tsx"), "utf8");
const route = readFileSync(resolve(process.cwd(), "src/app/api/estoque/itens/[itemId]/imagem/route.ts"), "utf8");

describe("estoque photo and form contracts", () => {
  it("oferece seleção local, preview, troca e remoção", () => {
    expect(form).toContain('type="file"');
    expect(form).toContain("URL.createObjectURL");
    expect(form).toContain("Trocar foto");
    expect(form).toContain("removeInventoryItemImage");
  });

  it("expõe cadastro rápido e campos avançados sem editar saldo", () => {
    expect(form).toContain("Tipo de controle");
    expect(form).toContain("Mais informações");
    expect(form).toContain("valorAquisicaoCentavos");
    expect(form).not.toContain("setQuantidade");
    expect(form).not.toContain("status: form.status");
  });

  it("protege troca e remoção com persistência e referências", () => {
    expect(route).toContain("getInventoryActor");
    expect(route).toContain("imagemAnteriorGerenciada");
    expect(route).toContain("db.produtoEstoque.count");
    expect(route).toContain("deleteIfUnreferenced");
    expect(route).toContain("if (uploadedUrl)");
    expect(route).toContain("prepareInventoryImageForStorage");
    expect(route).toContain("prepared.bytes");
  });

  it("otimiza imagens gerenciadas na lista e no drawer", () => {
    const table = readFileSync(resolve(process.cwd(), "src/components/Estoque/InventoryItemsTable.tsx"), "utf8");
    const details = readFileSync(resolve(process.cwd(), "src/components/Estoque/InventoryItemDetails.tsx"), "utf8");
    expect(table).toContain("unoptimized={!isOptimizableInventoryImage(item.imagem)}");
    expect(details).toContain("unoptimized={!isOptimizableInventoryImage(item.imagem)}");
  });

  it("não aceita URL de imagem arbitrária pela action cadastral", () => {
    const action = readFileSync(resolve(process.cwd(), "src/actions/Estoque.ts"), "utf8");
    const itemService = readFileSync(resolve(process.cwd(), "src/lib/estoque/items-service.ts"), "utf8");
    const itemSchema = itemService.slice(itemService.indexOf("inventoryItemInputSchema"), itemService.indexOf("export interface InventoryItemServiceActor"));
    expect(itemSchema).not.toContain("imagem");
    expect(itemService).toContain("imagem: null");
    expect(action).toContain("saveInventoryItem(payload");
  });
});
