import { describe, expect, it } from "vitest";
import { canConfirmInventoryReturns, canManageInventory, canViewPersonalInventory } from "@/lib/estoque/access";

describe("política de acesso do Estoque Alpha", () => {
  it.each(["Admin", "TI", "CEO", "Financeiro", "Recursos Humanos"])("permite gestão completa para %s", (role) => {
    expect(canManageInventory(role)).toBe(true);
  });

  it.each(["Comercial", "Operacional", "Marketing", "Serviços Gerais"])("limita %s à visão pessoal", (role) => {
    expect(canManageInventory(role)).toBe(false);
    expect(canViewPersonalInventory()).toBe(true);
  });

  it("permite confirmar devoluções exclusivamente ao TI", () => {
    expect(canConfirmInventoryReturns("TI")).toBe(true);
    for (const role of ["Admin", "CEO", "Financeiro", "Recursos Humanos", "Comercial"]) {
      expect(canConfirmInventoryReturns(role)).toBe(false);
    }
  });
});
