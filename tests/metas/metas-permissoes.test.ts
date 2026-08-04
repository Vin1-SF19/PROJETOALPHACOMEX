import { describe, expect, it } from "vitest";

import { podeGerenciarMetas } from "@/lib/metas-permissoes";

describe("podeGerenciarMetas", () => {
  it.each(["Admin", "CEO", "TI", "admin", "ceo", "T.I"])(
    "permite role administrativa (tolerante a caixa/acentos/pontuação) %s",
    (role) => {
      expect(podeGerenciarMetas(role)).toBe(true);
    },
  );

  it("permite Lider Comercial (comparação EXATA, sem normalização)", () => {
    expect(podeGerenciarMetas("Lider Comercial")).toBe(true);
  });

  it.each(["lider comercial", "LIDER COMERCIAL", "Líder Comercial"])(
    "nega variações de caixa/acento de Lider Comercial — comparação é case-sensitive, diferente de isAdminRole %s",
    (role) => {
      expect(podeGerenciarMetas(role)).toBe(false);
    },
  );

  it.each(["COMERCIAL", "User", "", "Financeiro"])(
    "nega role sem privilégio de gestão de metas %s",
    (role) => {
      expect(podeGerenciarMetas(role)).toBe(false);
    },
  );

  it("nega undefined/null tratados como string vazia", () => {
    expect(podeGerenciarMetas(undefined as unknown as string)).toBe(false);
  });
});
