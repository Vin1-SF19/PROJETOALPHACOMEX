import { describe, expect, it } from "vitest";
import { etapaResumoInicialId, etapasAnterioresParaResumo } from "@/lib/bpm/resumo-etapas";

const etapas = [
  { id: "novos", nome: "Novos Leads", ordem: 1 },
  { id: "tratativa", nome: "Em Tratativa", ordem: 2 },
  { id: "reuniao", nome: "Reunião Agendada", ordem: 3 },
  { id: "fechado", nome: "Fechado", ordem: 4 },
];

describe("resumo de etapas anteriores", () => {
  it("abre a etapa imediatamente anterior e mantém as anteriores abaixo", () => {
    expect(etapasAnterioresParaResumo(etapas, "reuniao").map((etapa) => etapa.id)).toEqual(["tratativa", "novos"]);
    expect(etapaResumoInicialId(etapas, "reuniao")).toBe("tratativa");
  });

  it("na última etapa abre a coluna anterior e lista todas as demais fechadas", () => {
    expect(etapasAnterioresParaResumo(etapas, "fechado").map((etapa) => etapa.id)).toEqual(["reuniao", "tratativa", "novos"]);
    expect(etapaResumoInicialId(etapas, "fechado")).toBe("reuniao");
  });

  it("não oferece resumo antes da primeira etapa", () => {
    expect(etapasAnterioresParaResumo(etapas, "novos")).toEqual([]);
    expect(etapaResumoInicialId(etapas, "novos")).toBeNull();
  });
});
