import { describe, expect, it } from "vitest";
import { processoOperacionalDeferido } from "@/lib/bpm/resultado-operacional";

describe("resultado operacional no card Fechado", () => {
  it("mostra DEFERIDO só para um processo Operacional deferido vinculado", () => {
    const deferido = [{ pipeline: "Operacional", etapa: "Processo deferido" }];
    expect(processoOperacionalDeferido("Fechado", deferido)).toBe(true);
    expect(processoOperacionalDeferido("Em tratativas", deferido)).toBe(false);
    expect(processoOperacionalDeferido("Fechado", [{ pipeline: "Operacional", etapa: "Processo indeferido" }])).toBe(false);
    expect(processoOperacionalDeferido("Fechado", [{ pipeline: null, etapa: null }])).toBe(false);
  });
});
