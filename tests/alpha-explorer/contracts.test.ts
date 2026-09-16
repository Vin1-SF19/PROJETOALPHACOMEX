import { describe, expect, it } from "vitest";

import { normalizeEtag } from "@/lib/storage/contracts";

describe("Alpha Explorer multipart contracts", () => {
  it("normaliza ETag com ou sem aspas", () => {
    expect(normalizeEtag("abc")).toBe('"abc"');
    expect(normalizeEtag('"abc"')).toBe('"abc"');
  });

  it("recusa ETag vazio", () => {
    expect(() => normalizeEtag("  ")).toThrow("ETag is required");
  });
});
