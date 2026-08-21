import { describe, expect, it } from "vitest";
import {
  ALPHA_SEO_SKILLS,
  discoverAlphaSeoSkills,
  getAlphaSeoSkill,
} from "@/lib/alpha-seo/skills/catalog";
describe("skills OpenSEO", () => {
  it("descobre exatamente os nove workflows distribuídos", () => {
    expect(ALPHA_SEO_SKILLS).toHaveLength(9);
    expect(new Set(ALPHA_SEO_SKILLS.map((s) => s.name)).size).toBe(9);
  });
  it("filtra catálogo", () =>
    expect(discoverAlphaSeoSkills("local").map((s) => s.name)).toContain(
      "local-seo",
    ));
  it("preserva as instruções e recursos distribuídos pela fonte", () => {
    for (const metadata of ALPHA_SEO_SKILLS) {
      expect(getAlphaSeoSkill(metadata.name).instructions.length).toBeGreaterThan(
        4_000,
      );
    }
    const audit = getAlphaSeoSkill("seo-audit");
    expect(audit.instructions.length).toBeGreaterThan(5_000);
    expect(Object.values(audit.resources).join("\n").toLowerCase()).toContain(
      "<!doctype html>",
    );
    expect(() => getAlphaSeoSkill("inexistente")).toThrow(
      "ALPHA_SEO_SKILL_NOT_FOUND",
    );
  });
});
