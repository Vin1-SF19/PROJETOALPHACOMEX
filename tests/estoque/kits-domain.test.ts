import { describe, expect, it } from "vitest";
import {
  inventoryKitAvailability,
  inventoryKitCode,
  kitStatusAfterReturn,
  normalizeInventoryTagName,
  saveInventoryKitComponentsSchema,
  saveInventoryTagSchema,
  returnInventoryKitSchema,
  validateInventoryKit,
  validateKitSelectionShape,
} from "@/lib/estoque/kits-domain";

const requirements = [
  { id: "notebook", produtoId: "p1", productName: "Notebook", quantityRequired: 1, required: true, sortOrder: 0 },
  { id: "mouse", produtoId: "p2", productName: "Mouse", quantityRequired: 2, required: true, sortOrder: 1 },
  { id: "monitor", produtoId: "p3", productName: "Monitor", quantityRequired: 1, required: false, sortOrder: 2 },
];

describe("inventory kit validation", () => {
  it("calcula n/m, faltantes e percentual usando somente requisitos obrigatórios", () => {
    const result = validateInventoryKit(requirements, [
      { requirementId: "notebook", produtoId: "p1", quantity: 1 },
      { requirementId: "mouse", produtoId: "p2", quantity: 1 },
    ]);
    expect(result).toMatchObject({ status: "KIT_INCOMPLETO", complete: false, percentage: 67, requiredFulfilled: 2, requiredTotal: 3 });
    expect(result.missing).toEqual([{ requirementId: "mouse", produtoId: "p2", productName: "Mouse", quantity: 1 }]);
    expect(result.requirements.map((item) => [item.id, item.selectedQuantity, item.quantityRequired])).toEqual([
      ["notebook", 1, 1], ["mouse", 1, 2], ["monitor", 0, 1],
    ]);
  });

  it("considera completo mesmo sem o item opcional", () => {
    const result = validateInventoryKit(requirements, [
      { requirementId: "notebook", produtoId: "p1", quantity: 1 },
      { requirementId: "mouse", produtoId: "p2", quantity: 2 },
    ]);
    expect(result).toMatchObject({ status: "KIT_COMPLETO", complete: true, percentage: 100, missing: [] });
  });

  it("não conta componente devolvido, incompatível ou desconhecido", () => {
    const result = validateInventoryKit(requirements, [
      { requirementId: "notebook", produtoId: "p1", quantity: 1, status: "DEVOLVIDO" },
      { requirementId: "mouse", produtoId: "produto-errado", quantity: 2 },
      { requirementId: "inexistente", produtoId: "p9", quantity: 1 },
    ]);
    expect(result.unmatchedComponentCount).toBe(3);
    expect(result.requiredFulfilled).toBe(0);
  });

  it("não declara completo um modelo sem requisitos obrigatórios", () => {
    expect(validateInventoryKit([{ ...requirements[2]!, required: false }], []).complete).toBe(false);
  });
});

describe("inventory kit stock availability", () => {
  const tag = {
    id: "tag-1", kind: "KIT_MODELO" as const, nome: "Kit Home Office", descricao: null, cor: "#2563eb", icone: "Laptop", categoriaId: null, categoria: null, version: 1, itemTags: [], kitInstances: [],
    requirements: [
      { id: "r1", produtoId: "p1", quantityRequired: 1, required: true, sortOrder: 0, observacao: null, produto: { id: "p1", nome: "Notebook", descricao: null, marca: null, modelo: null, imagem: null, quantidade: 0, trackingMode: "INDIVIDUAL", unidade: "un", assets: [] } },
      { id: "r2", produtoId: "p2", quantityRequired: 2, required: true, sortOrder: 1, observacao: null, produto: { id: "p2", nome: "Mouse", descricao: null, marca: null, modelo: null, imagem: null, quantidade: 0, trackingMode: "QUANTIDADE", unidade: "un", assets: [] } },
    ],
  };
  const product = (id: string, quantidade: number, trackingMode = "QUANTIDADE", statuses: string[] = []) => ({
    id, nome: id, descricao: null, marca: null, modelo: null, imagem: null, quantidade, trackingMode, unidade: "un",
    assets: statuses.map((status, index) => ({ id: `a${index}`, patrimonio: null, serial: null, codigoInterno: null, status })),
  });

  it("fica crítico quando um obrigatório zera e calcula quantos kits cabem", () => {
    const result = inventoryKitAvailability(tag, [product("p1", 0, "INDIVIDUAL", []), product("p2", 8)]);
    expect(result.alert).toBe("CRITICAL");
    expect(result.completeKitsPossible).toBe(0);
    expect(result.requirements[0]).toMatchObject({ available: 0, missingForOne: 1 });
  });

  it("avisa quando resta estoque para somente um kit", () => {
    const result = inventoryKitAvailability(tag, [product("p1", 2, "INDIVIDUAL", ["DISPONIVEL", "EM_USO"]), product("p2", 3)]);
    expect(result.alert).toBe("WARNING");
    expect(result.completeKitsPossible).toBe(1);
  });
});

describe("inventory kit inputs", () => {
  it("normaliza nomes e gera código legível determinístico com sementes", () => {
    expect(normalizeInventoryTagName("  Kít   Home Óffice ")).toBe("kit home office");
    expect(inventoryKitCode("Kit Home Office", new Date("2026-09-18T12:00:00Z"), "abc123")).toBe("KIT-HOME-OFFICE-20260918-ABC123");
  });

  it("rejeita produto duplicado no modelo", () => {
    const result = saveInventoryTagSchema.safeParse({
      kind: "KIT_MODELO", nome: "Kit TI", cor: "#2563eb", produtoIds: [],
      requirements: [
        { produtoId: "p1", quantityRequired: 1, required: true, sortOrder: 0 },
        { produtoId: "p1", quantityRequired: 2, required: false, sortOrder: 1 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejeita quantidades nulas e aceita seleção individual unitária", () => {
    expect(saveInventoryKitComponentsSchema.safeParse({ kitInstanceId: "k1", version: 1, components: [{ requirementId: "r1", produtoId: "p1", quantity: 0 }] }).success).toBe(false);
    expect(saveInventoryKitComponentsSchema.safeParse({ kitInstanceId: "k1", version: 1, components: [{ requirementId: "r1", produtoId: "p1", assetId: "a1", quantity: 1 }] }).success).toBe(true);
  });

  it("rejeita patrimônio duplicado, individual sem asset e quantidade acima do modelo", () => {
    const selectionRequirements = [{ id: "r1", produtoId: "p1", productName: "Notebook", trackingMode: "INDIVIDUAL", quantityRequired: 2 }];
    expect(validateKitSelectionShape(selectionRequirements, [{ requirementId: "r1", produtoId: "p1", quantity: 1 }])).toMatchObject({ valid: false, error: expect.stringContaining("patrimônio") });
    expect(validateKitSelectionShape(selectionRequirements, [
      { requirementId: "r1", produtoId: "p1", assetId: "a1", quantity: 1 },
      { requirementId: "r1", produtoId: "p1", assetId: "a1", quantity: 1 },
    ])).toMatchObject({ valid: false, error: expect.stringContaining("mais de uma vez") });
    expect(validateKitSelectionShape([{ ...selectionRequirements[0]!, trackingMode: "QUANTIDADE", quantityRequired: 1 }], [{ requirementId: "r1", produtoId: "p1", quantity: 2 }])).toMatchObject({ valid: false, error: expect.stringContaining("excede") });
  });

  it("mantém devolução pendente até todos os retornáveis voltarem e ignora consumíveis", () => {
    expect(kitStatusAfterReturn([
      { usagePolicy: "RETORNAVEL", quantity: 1, returnedQuantity: 1 },
      { usagePolicy: "RETORNAVEL", quantity: 2, returnedQuantity: 1 },
      { usagePolicy: "CONSUMIVEL", quantity: 3, returnedQuantity: 0 },
    ])).toBe("DEVOLUCAO_PENDENTE");
    expect(kitStatusAfterReturn([
      { usagePolicy: "RETORNAVEL", quantity: 1, returnedQuantity: 1 },
      { usagePolicy: "CONSUMIVEL", quantity: 3, returnedQuantity: 0 },
    ])).toBe("DEVOLVIDO");
    expect(kitStatusAfterReturn([{ usagePolicy: "CONSUMIVEL", quantity: 3, returnedQuantity: 0 }])).toBe("DEVOLUCAO_PENDENTE");
  });

  it("rejeita o mesmo componente repetido numa devolução", () => {
    const result = returnInventoryKitSchema.safeParse({
      kitInstanceId: "kit-1",
      version: 2,
      idempotencyKey: "return-key-123",
      lines: [
        { kitComponentId: "component-1", quantity: 1, condition: "BOM" },
        { kitComponentId: "component-1", quantity: 1, condition: "DANIFICADO" },
      ],
    });
    expect(result.success).toBe(false);
  });
});
