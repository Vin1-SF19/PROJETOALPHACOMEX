import { describe, expect, it } from "vitest";

import {
  ERRO_DATA_REUNIAO_OBRIGATORIA,
  obterErroDataReuniaoParaMovimento,
  resolverInicioCicloNaEtapa,
} from "@/lib/bpm/agendar-reuniao";
import { cicloNovosLeadsVencido } from "@/lib/bpm/novos-leads";

describe("guard de Data e Hora em Agendar reunião", () => {
  it("bloqueia o avanço para Reunião Agendada sem data persistida", () => {
    expect(obterErroDataReuniaoParaMovimento({
      etapaOrigemNome: "Agendar reunião",
      etapaDestinoNome: "Reunião Agendada",
      dataReuniao: null,
    })).toBe(ERRO_DATA_REUNIAO_OBRIGATORIA);
  });

  it("permite o avanço quando Data e Hora estão preenchidas", () => {
    expect(obterErroDataReuniaoParaMovimento({
      etapaOrigemNome: "Agendar reunião",
      etapaDestinoNome: "Reunião Agendada",
      dataReuniao: new Date("2026-08-20T15:00:00.000Z"),
    })).toBeNull();
  });

  it("mantém Standby disponível como saída de contingência", () => {
    expect(obterErroDataReuniaoParaMovimento({
      etapaOrigemNome: "Agendar reunião",
      etapaDestinoNome: "Standby - Follow Up",
      dataReuniao: null,
    })).toBeNull();
  });
});

describe("ciclo de oito dias em Agendar reunião", () => {
  it("usa a entrada mais recente na etapa como início do ciclo", () => {
    const inicio = resolverInicioCicloNaEtapa(
      "etapa_agendar",
      new Date("2026-07-01T12:00:00.000Z"),
      [
        {
          createdAt: new Date("2026-08-10T12:00:00.000Z"),
          valorNovoJson: JSON.stringify({ etapaId: "etapa_agendar" }),
        },
        {
          createdAt: new Date("2026-07-15T12:00:00.000Z"),
          valorNovoJson: JSON.stringify({ etapaId: "outra_etapa" }),
        },
      ],
    );

    expect(inicio.toISOString()).toBe("2026-08-10T12:00:00.000Z");
    expect(cicloNovosLeadsVencido(inicio, new Date("2026-08-19T12:00:00.000Z"))).toBe(false);
    expect(cicloNovosLeadsVencido(inicio, new Date("2026-08-20T12:00:00.000Z"))).toBe(true);
  });

  it("usa createdAt como fallback para card legado sem histórico válido", () => {
    const createdAt = new Date("2026-08-03T12:00:00.000Z");
    expect(resolverInicioCicloNaEtapa(
      "etapa_agendar",
      createdAt,
      [{ createdAt: new Date(), valorNovoJson: "json inválido" }],
    )).toBe(createdAt);
  });
});

