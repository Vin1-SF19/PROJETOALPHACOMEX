import { describe, expect, it } from "vitest";
import {
  normalizeAlphaSeoDomain,
  normalizeAlphaSeoEmail,
} from "@/lib/alpha-seo/projects/normalize";

describe("Alpha SEO projects", () => {
  it("canonicalizes domains before persistence", () => {
    expect(normalizeAlphaSeoDomain("https://WWW.Example.COM/path?q=1")).toBe(
      "example.com",
    );
    expect(normalizeAlphaSeoDomain(" ")).toBeNull();
  });
  it("rejects unsafe or malformed domains", () => {
    expect(() => normalizeAlphaSeoDomain("javascript:alert(1)")).toThrow();
    expect(() => normalizeAlphaSeoDomain("localhost")).toThrow();
  });
  it("normalizes invitation email", () =>
    expect(normalizeAlphaSeoEmail(" User@Example.COM ")).toBe(
      "user@example.com",
    ));
});
