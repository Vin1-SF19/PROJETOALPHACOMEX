import { describe, expect, it } from "vitest";

import {
  evaluateExplorerCapability,
  type ExplorerGrant,
  userPrivatePrefix,
} from "@/lib/alpha-explorer/capabilities";

const grants: ExplorerGrant[] = [
  { prefix: "financeiro", capabilities: ["list", "read"], source: "sector", sourceId: "financeiro" },
  { prefix: "financeiro/envios", capabilities: ["upload"], source: "user", sourceId: "123" },
];

describe("Alpha Explorer capabilities", () => {
  it("concede somente capacidade e prefixo explicitamente compatíveis", () => {
    expect(evaluateExplorerCapability(grants, "financeiro/2026", "read").allowed).toBe(true);
    expect(evaluateExplorerCapability(grants, "financeiro/2026", "upload").allowed).toBe(false);
    expect(evaluateExplorerCapability(grants, "financeiro/envios/nota.pdf", "upload").allowed).toBe(true);
    expect(evaluateExplorerCapability(grants, "financeiro-publico", "read").allowed).toBe(false);
  });

  it("retorna a origem da regra mais específica", () => {
    const decision = evaluateExplorerCapability(
      [...grants, { prefix: "financeiro/envios", capabilities: ["read"], source: "user", sourceId: "123" }],
      "financeiro/envios/nota.pdf",
      "read",
    );
    expect(decision.matchedGrant?.source).toBe("user");
    expect(decision.matchedGrant?.sourceId).toBe("123");
  });

  it("falha fechado sem regras e usa somente ID interno no prefixo privado", () => {
    expect(evaluateExplorerCapability([], "compartilhados", "list").allowed).toBe(false);
    expect(userPrivatePrefix(123)).toBe("usuarios/123");
    expect(() => userPrivatePrefix(0)).toThrow("Invalid internal user ID");
  });
});
