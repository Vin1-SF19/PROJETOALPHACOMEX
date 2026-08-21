import { describe, expect, it } from "vitest";
import { safeAlphaSeoActionError } from "@/lib/alpha-seo/action-error";

describe("Alpha SEO action errors", () => {
  it("does not expose arbitrary internal messages", () => {
    expect(safeAlphaSeoActionError(new Error("token abc123 em /internal/path"))).toBe(
      "Não foi possível concluir a operação Alpha SEO",
    );
  });

  it("preserves stable business error codes", () => {
    expect(safeAlphaSeoActionError(new Error("COST_APPROVAL_REQUIRED"))).toBe(
      "COST_APPROVAL_REQUIRED",
    );
  });

  it("preserves explicitly allowed business messages", () => {
    expect(
      safeAlphaSeoActionError(
        new Error("A tag está vinculada a 3 palavra(s)-chave"),
      ),
    ).toBe("A tag está vinculada a 3 palavra(s)-chave");
  });

  it("preserves typed access errors without exposing generic errors", () => {
    const accessError = Object.assign(new Error("Acesso negado ao projeto Alpha SEO"), {
      name: "AlphaSeoAccessError",
      code: "PROJECT_ACCESS_DENIED",
    });

    expect(safeAlphaSeoActionError(accessError)).toBe(
      "Acesso negado ao projeto Alpha SEO",
    );
  });
});
