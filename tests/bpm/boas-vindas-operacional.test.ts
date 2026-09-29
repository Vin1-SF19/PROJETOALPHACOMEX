import { describe, expect, it } from "vitest";
import {
  DIRETOR_OPERACIONAL_VITOR_ID,
  etapaEhBoasVindas,
  pendenciasSaidaBoasVindasOperacional,
  podeAgirBoasVindasOperacional,
} from "@/lib/bpm/boas-vindas";

describe("Boas-vindas do Operacional", () => {
  it("reconhece o nome efetivamente publicado da etapa", () => {
    expect(etapaEhBoasVindas("Boas vindas")).toBe(true);
    expect(etapaEhBoasVindas("Boas-vindas")).toBe(true);
  });
  it("autoriza Admin e Vitor sem abrir a coluna a toda a role Operacional ou ao bypass TI/CEO", () => {
    expect(podeAgirBoasVindasOperacional(1, "Admin")).toBe(true);
    expect(podeAgirBoasVindasOperacional(DIRETOR_OPERACIONAL_VITOR_ID, "OPERACIONAL")).toBe(true);
    expect(podeAgirBoasVindasOperacional(42, "OPERACIONAL")).toBe(false);
    expect(podeAgirBoasVindasOperacional(7, "TI")).toBe(false);
    expect(podeAgirBoasVindasOperacional(8, "CEO")).toBe(false);
  });

  it("bloqueia a saída antes da atribuição e da confirmação do Google Meet", () => {
    expect(pendenciasSaidaBoasVindasOperacional({
      responsavelId: DIRETOR_OPERACIONAL_VITOR_ID, responsavelRole: "OPERACIONAL", responsavelCargo: "Diretor Operacional", dataReuniao: null,
      googleEventId: null, googleMeetLink: null,
    })).toEqual(["Analista responsável", "Primeira reunião Google Meet agendada"]);
    expect(pendenciasSaidaBoasVindasOperacional({
      responsavelId: 23, responsavelRole: "OPERACIONAL", responsavelCargo: "Analista Operacional", dataReuniao: new Date("2026-10-01T12:00:00Z"),
      googleEventId: "evento-1", googleMeetLink: "https://meet.google.com/abc-defg-hij",
    })).toEqual([]);
    expect(pendenciasSaidaBoasVindasOperacional({
      responsavelId: 23, responsavelRole: "COMERCIAL", responsavelCargo: "Analista Operacional", dataReuniao: new Date("2026-10-01T12:00:00Z"),
      googleEventId: "evento-1", googleMeetLink: "https://meet.google.com/abc-defg-hij",
    })).toContain("Analista responsável");
    expect(pendenciasSaidaBoasVindasOperacional({
      responsavelId: 23, responsavelRole: "OPERACIONAL", responsavelCargo: "Contador Auditor", dataReuniao: new Date("2026-10-01T12:00:00Z"),
      googleEventId: "evento-1", googleMeetLink: "https://meet.google.com/abc-defg-hij",
    })).toContain("Analista responsável");
  });
});
