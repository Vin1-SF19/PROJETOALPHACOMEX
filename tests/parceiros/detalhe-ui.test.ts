import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const raiz = process.cwd();

function ler(caminho: string): string {
  return readFileSync(join(raiz, caminho), "utf8");
}

describe("detalhe do parceiro", () => {
  it("exibe exatamente cinco estrelas para o potencial de recorrência", () => {
    const relacionamento = ler("src/components/Parceiros/Relacionamento360Section.tsx");

    expect(relacionamento).toContain("[1, 2, 3, 4, 5].map((n) => (");
    expect(relacionamento).not.toContain("[0, 1, 2, 3, 4, 5].map((n) => (");
    expect(relacionamento).toContain("onClick={() => void salvarPotencial(n)}");
  });

  it("mantém o modal de credenciais contido e rolável em telas pequenas", () => {
    const modal = ler("src/components/Parceiros/ModalCredenciais.tsx");

    expect(modal).toContain("max-h-[calc(100dvh-2rem)]");
    expect(modal).toContain("w-[calc(100%-2rem)]");
    expect(modal).toContain("overflow-x-hidden overflow-y-auto");
    expect(modal).toContain("min-w-0 flex-1 break-all");
    expect(modal).toContain("whitespace-pre-wrap break-words");
  });
});
