import { describe, expect, it } from "vitest";

import {
  ERRO_DATA_REUNIAO_OBRIGATORIA,
  obterErroDataReuniaoParaMovimento,
  resolverInicioCicloNaEtapa,
  contarMaiorSequenciaDiasConsecutivos,
  obterErroContatosConsecutivosParaMovimento,
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

describe("contarMaiorSequenciaDiasConsecutivos", () => {
  it("retorna 0 quando não há datas", () => {
    expect(contarMaiorSequenciaDiasConsecutivos([])).toBe(0);
  });

  it("conta corretamente 8 dias corridos consecutivos", () => {
    const datas = Array.from({ length: 8 }, (_, indice) =>
      new Date(`2026-08-${String(indice + 1).padStart(2, "0")}T12:00:00.000Z`));
    expect(contarMaiorSequenciaDiasConsecutivos(datas)).toBe(8);
  });

  it("ignora duplicatas no mesmo dia", () => {
    const datas = [
      new Date("2026-08-01T08:00:00.000Z"),
      new Date("2026-08-01T20:00:00.000Z"),
      new Date("2026-08-02T08:00:00.000Z"),
    ];
    expect(contarMaiorSequenciaDiasConsecutivos(datas)).toBe(2);
  });

  it("encontra a maior sequência mesmo com lacunas", () => {
    const datas = [
      new Date("2026-08-01T12:00:00.000Z"),
      new Date("2026-08-02T12:00:00.000Z"),
      new Date("2026-08-10T12:00:00.000Z"),
      new Date("2026-08-11T12:00:00.000Z"),
      new Date("2026-08-12T12:00:00.000Z"),
    ];
    expect(contarMaiorSequenciaDiasConsecutivos(datas)).toBe(3);
  });
});

describe("guard de 8 contatos consecutivos em Agendar reunião", () => {
  it("bloqueia quando não há 8 dias consecutivos de contato", () => {
    const datas = [
      new Date("2026-08-01T12:00:00.000Z"),
      new Date("2026-08-02T12:00:00.000Z"),
    ];
    expect(obterErroContatosConsecutivosParaMovimento({
      etapaOrigemNome: "Agendar reunião",
      datasContato: datas,
    })).toContain("Contatos consecutivos registrados: 2 de 8");
  });

  it("permite avançar com 8 dias consecutivos de contato registrados", () => {
    const datas = Array.from({ length: 8 }, (_, indice) =>
      new Date(`2026-08-${String(indice + 1).padStart(2, "0")}T12:00:00.000Z`));
    expect(obterErroContatosConsecutivosParaMovimento({
      etapaOrigemNome: "Agendar reunião",
      datasContato: datas,
    })).toBeNull();
  });

  it("não se aplica a etapas diferentes de Agendar reunião", () => {
    expect(obterErroContatosConsecutivosParaMovimento({
      etapaOrigemNome: "Novos leads",
      datasContato: [],
    })).toBeNull();
  });
});

