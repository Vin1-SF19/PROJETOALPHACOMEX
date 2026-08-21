import { describe, expect, it } from "vitest";
import {
  memoryUpdateSchema,
  renderProjectMemory,
  SECTION_KEYS,
} from "@/lib/alpha-seo/project-memory/service";

describe("Project Memory", () => {
  it("mantém seções normalizadas", () =>
    expect(SECTION_KEYS).toContain("site_scope"));
  it("rejeita operações extras", () =>
    expect(
      memoryUpdateSchema.safeParse({
        kind: "appendResearch",
        summary: "ok",
        userId: 999,
      }).success,
    ).toBe(false));
  it("renderiza seções ausentes sem inventar conteúdo", () => {
    const markdown = renderProjectMemory({
      sections: [],
      missingSections: [...SECTION_KEYS],
      competitors: [],
      keyPages: [],
      researchLog: [],
    });
    expect(markdown).toContain("Seções ausentes");
    expect(markdown).toContain("site_scope");
  });
});
