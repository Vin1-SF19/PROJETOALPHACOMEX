import { describe, expect, it } from "vitest";
import { MODULOS_REGISTRY, podeVisualizarModulo } from "@/lib/modulos-registry";
import { hasInventoryPermission } from "@/lib/estoque/access";
import type { InventoryItem } from "@/lib/estoque/types";
import { filterInventoryItems, getInventorySummary, isLowStock } from "@/lib/estoque/view-model";

const items: InventoryItem[] = [
  { id: "1", nome: "Café", quantidade: 6, estoqueMinimo: 2, unidade: "pacote", categoriaId: "a", categoria: { id: "a", nome: "Alimentos" } },
  { id: "2", nome: "Mouse Óptico", quantidade: 0, estoqueMinimo: 5, unidade: "unidade", categoriaId: "b", categoria: { id: "b", nome: "Periféricos" } },
  { id: "3", nome: "Cabo USB", quantidade: 3, estoqueMinimo: 3, unidade: "unidade", categoriaId: "b", categoria: { id: "b", nome: "Periféricos" } },
];

describe("estoque view model", () => {
  it("calcula indicadores apenas com dados persistidos recebidos", () => {
    expect(getInventorySummary(items)).toEqual({ itensCadastrados: 3, disponiveis: 9, emUso: 0, estoqueBaixo: 2 });
  });

  it("considera baixo estoque quando disponível é igual ou menor que o mínimo", () => {
    expect(isLowStock(items[0])).toBe(false);
    expect(isLowStock(items[2])).toBe(true);
  });

  it("busca sem diferenciar acentos e combina categoria e saldo", () => {
    expect(filterInventoryItems(items, { search: "optico", categoryId: "b", stock: "SEM_ESTOQUE" }).map((item) => item.id)).toEqual(["2"]);
  });

  it("não inclui item com saldo negativo no total disponível", () => {
    expect(getInventorySummary([{ ...items[0], quantidade: -5 }]).disponiveis).toBe(0);
  });
});

describe("estoque access and navigation", () => {
  it("aceita permissão canônica, compatibilidade legada e bypass administrativo", () => {
    expect(hasInventoryPermission("User", ["estoque"])).toBe(true);
    expect(hasInventoryPermission("User", ["ServiçosGerais"])).toBe(true);
    expect(hasInventoryPermission("TI", [])).toBe(true);
    expect(hasInventoryPermission("User", [])).toBe(false);
  });

  it("registra uma única rota canônica visível para o estoque", () => {
    const modules = MODULOS_REGISTRY.filter((module) => module.id === "estoque");
    expect(modules).toHaveLength(1);
    expect(modules[0]).toMatchObject({ href: "/PainelAlpha/Estoque", permission: null });
    expect(modules[0]?.hidden).not.toBe(true);
  });

  it("mantém a rota canônica visível para a permissão legada aceita pelo servidor", () => {
    const inventoryModule = MODULOS_REGISTRY.find((candidate) => candidate.id === "estoque");
    expect(inventoryModule).toBeDefined();
    expect(podeVisualizarModulo(inventoryModule!, { permissoes: ["ServiçosGerais"], role: "User" })).toBe(true);
  });
});
