import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const painel = readFileSync("src/components/bpm/cadencias/PainelCadenciasCard.tsx", "utf8");
const formulario = readFileSync("src/components/bpm/cadencias/CadenciaFormDialog.tsx", "utf8");

describe("interface de cadências automáticas", () => {
  it("não expõe início, pausa ou reativação manual no card", () => {
    expect(painel).not.toContain("IniciarCadenciaCardBpm");
    expect(painel).not.toContain("PausarCadenciaCardBpm");
    expect(painel).not.toContain("ReativarCadenciaCardBpm");
    expect(painel).toContain("ativadas automaticamente");
    expect(painel).toContain("Próximo passo:");
    expect(painel).toContain("Escopo:");
  });

  it("oferece pipeline e multiselect, limpando as colunas quando o pipeline muda", () => {
    expect(formulario).toContain('aria-label="Pipeline da cadência"');
    expect(formulario).toContain('aria-label="Seleção de colunas da cadência"');
    expect(formulario).toContain('setValue("etapaIds", []');
    expect(formulario).toContain("Sem seleção, a cadência será iniciada somente na entrada do pipeline");
    expect(formulario).toContain("criarCadenciaSchema");
  });
});
