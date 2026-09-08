import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const arquivos = [
  "src/actions/bpm/Cards.ts",
  "src/actions/bpm/NolossLeads.ts",
  "src/lib/bpm/transicao-command.ts",
  "src/lib/bpm/automacoes.ts",
  "src/lib/bpm/automacao-novos-leads.ts",
  "src/lib/bpm/automacoes/central-runtime.ts",
  "src/lib/bpm/automacoes/distribuicao-oportunidades.ts",
];

describe("integração transacional das cadências", () => {
  it.each(arquivos)("%s usa o serviço que recebe a transação do card", (arquivo) => {
    const fonte = readFileSync(resolve(process.cwd(), arquivo), "utf8");
    expect(fonte).toContain("ativarCadenciasNaEntradaBpm");
    expect(fonte).not.toContain("sincronizarCadenciasNaEntradaBpm");
    expect(fonte).toMatch(/ativarCadenciasNaEntradaBpm\([\s\S]*?\}, tx\)/);
  });
});
