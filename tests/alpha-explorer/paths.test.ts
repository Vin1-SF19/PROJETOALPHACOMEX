import { describe, expect, it } from "vitest";

import {
  ExplorerPathError,
  isPathWithinPrefix,
  joinLogicalPath,
  logicalParent,
  normalizeFolderPrefix,
  normalizeLogicalPath,
} from "@/lib/alpha-explorer/paths";

describe("Alpha Explorer logical paths", () => {
  it("normaliza barras, espaços, segmentos vazios e Unicode NFC", () => {
    expect(normalizeLogicalPath(" /comercial//Propostas\\Cafe\u0301/ ")).toBe("comercial/Propostas/Café");
    expect(normalizeFolderPrefix("financeiro/notas")).toBe("financeiro/notas/");
  });

  it.each(["../segredo", "..\\segredo", "%2e%2e/segredo", "%252e%252e%252fsegredo"])(
    "rejeita traversal %s",
    (path) => expect(() => normalizeLogicalPath(path)).toThrow(ExplorerPathError),
  );

  it("compara prefixos respeitando o limite do segmento", () => {
    expect(isPathWithinPrefix("financeiro/2026/notas", "financeiro")).toBe(true);
    expect(isPathWithinPrefix("financeiro", "financeiro")).toBe(true);
    expect(isPathWithinPrefix("financeiro-publico/notas", "financeiro")).toBe(false);
  });

  it("rejeita nomes não portáveis ou ativos", () => {
    expect(() => normalizeLogicalPath("financeiro/arquivo. ")).toThrow("not portable");
    expect(() => normalizeLogicalPath(`financeiro/a\u0000b`)).toThrow("forbidden character");
    expect(normalizeLogicalPath("financeiro/<script>alert(1)</script>.txt")).toBe(
      "financeiro/<script>alert(1)</script>.txt",
    );
  });

  it("faz join e encontra pai sem permitir que o filho escape", () => {
    expect(joinLogicalPath("comercial/propostas", "2026/acme.pdf")).toBe("comercial/propostas/2026/acme.pdf");
    expect(logicalParent("comercial/propostas/acme.pdf")).toBe("comercial/propostas");
    expect(logicalParent("comercial")).toBe("");
    expect(logicalParent("")).toBeNull();
    expect(() => joinLogicalPath("comercial", "../financeiro")).toThrow(ExplorerPathError);
  });
});
