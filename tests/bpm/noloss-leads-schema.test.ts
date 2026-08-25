import { describe, expect, it } from "vitest";

import { promoverNolossLeadSchema } from "@/lib/validations/bpm";

const NOLOSS_LEAD_ID = "clw0000000000000lead";
const ETAPA_ID = "clw0000000000000etap";

describe("promoverNolossLeadSchema", () => {
  it("aceita payload válido", () => {
    const resultado = promoverNolossLeadSchema.safeParse({
      nolossLeadId: NOLOSS_LEAD_ID,
      etapaDestinoId: ETAPA_ID,
      responsavelId: 7,
    });
    expect(resultado.success).toBe(true);
  });

  it("rejeita nolossLeadId que não é cuid", () => {
    const resultado = promoverNolossLeadSchema.safeParse({
      nolossLeadId: "id-invalido",
      etapaDestinoId: ETAPA_ID,
      responsavelId: 7,
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita etapaDestinoId que não é cuid", () => {
    const resultado = promoverNolossLeadSchema.safeParse({
      nolossLeadId: NOLOSS_LEAD_ID,
      etapaDestinoId: "id-invalido",
      responsavelId: 7,
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita responsavelId não-positivo", () => {
    const resultado = promoverNolossLeadSchema.safeParse({
      nolossLeadId: NOLOSS_LEAD_ID,
      etapaDestinoId: ETAPA_ID,
      responsavelId: 0,
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita responsavelId não-inteiro", () => {
    const resultado = promoverNolossLeadSchema.safeParse({
      nolossLeadId: NOLOSS_LEAD_ID,
      etapaDestinoId: ETAPA_ID,
      responsavelId: 7.5,
    });
    expect(resultado.success).toBe(false);
  });

  it("rejeita payload sem nenhum campo", () => {
    const resultado = promoverNolossLeadSchema.safeParse({});
    expect(resultado.success).toBe(false);
  });
});
