import { describe, expect, it } from "vitest";

import { MODULOS_REGISTRY, type ModuloRegistryItem } from "@/lib/modulos-registry";
import { auditRoadmapModuleCatalog, getRoadmapModuleCatalog } from "@/lib/roadmap-alpha/catalog";

function moduleFixture(overrides: Partial<ModuloRegistryItem> = {}): ModuloRegistryItem {
  return {
    id: "crm",
    label: "Alpha CRM",
    href: "/PainelAlpha/AlphaCRM",
    iconName: "BarChart3",
    category: "comercial",
    permission: "crm",
    ...overrides,
  };
}

describe("catálogo do Roadmap Alpha", () => {
  it("inclui 100% do registry sem filtrar módulos administrativos ou ocultos", () => {
    const catalog = getRoadmapModuleCatalog();
    expect(catalog).toHaveLength(MODULOS_REGISTRY.length);
    expect(catalog.map((item) => item.id)).toEqual(MODULOS_REGISTRY.map((item) => item.id));
    expect(catalog.every((item) => Object.keys(item).sort().join(",") === "category,href,id,label,permission")).toBe(true);
  });

  it("aprova o registry canônico atual", () => {
    const audit = auditRoadmapModuleCatalog();
    expect(audit.ok).toBe(true);
    expect(audit.issues).toEqual([]);
  });

  it("reporta IDs duplicados após normalização", () => {
    const audit = auditRoadmapModuleCatalog([
      moduleFixture({ id: "CRM" }),
      moduleFixture({ id: "crm", href: "/PainelAlpha/Outro" }),
    ]);
    expect(audit.ok).toBe(false);
    expect(audit.issues).toContainEqual(expect.objectContaining({ code: "DUPLICATE_ID", moduleId: "crm" }));
  });

  it("reporta campos inválidos sem escrever na fonte", () => {
    const source = [moduleFixture({ href: "https://externo.invalid" })];
    const before = structuredClone(source);
    const audit = auditRoadmapModuleCatalog(source);
    expect(audit.issues).toContainEqual(expect.objectContaining({ code: "INVALID_ITEM", fields: ["href"] }));
    expect(source).toEqual(before);
  });
});
