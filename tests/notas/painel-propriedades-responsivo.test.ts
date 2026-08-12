import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Painel de propriedades da nota — responsividade", () => {
  it("mantém o card limitado à tela com rolagem interna sutil", () => {
    const painel = readFileSync(
      resolve(process.cwd(), "src/components/Notas/Central/PainelPropriedades.tsx"),
      "utf8",
    );
    const central = readFileSync(
      resolve(process.cwd(), "src/components/Notas/Central/CentralDeNotas.tsx"),
      "utf8",
    );

    expect(painel).toContain("custom-scrollbar");
    expect(painel).toContain("min-h-0");
    expect(painel).toContain("overflow-y-auto");
    expect(painel).toContain("overscroll-contain");
    expect(central).toContain('<NotasCard3D delay={0.15} className="h-full min-h-0">');
  });
});
