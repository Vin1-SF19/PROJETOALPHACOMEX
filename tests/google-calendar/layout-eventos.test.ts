import { describe, expect, it } from "vitest";

import { calcularPosicoesEventosDoDia, eventosDiaInteiroDoDia } from "@/components/CalendarioAlpha/lib/layout-eventos";
import type { EventoExibicao } from "@/components/CalendarioAlpha/lib/tipos";

const DIA = new Date("2026-07-20T00:00:00");

function evento(overrides: Partial<EventoExibicao> = {}): EventoExibicao {
  return {
    id: "1",
    googleEventId: "evt_1",
    status: "confirmed",
    titulo: "Evento",
    inicioEm: "2026-07-20T10:00:00",
    fimEm: "2026-07-20T11:00:00",
    diaInteiro: false,
    etag: "e1",
    linkMeet: null,
    calendarioId: "cal_1",
    calendarioGoogleId: "primary",
    calendarioNome: "Principal",
    calendarioCorHex: "#3b82f6",
    calendarioGravavel: true,
    ...overrides,
  };
}

describe("calcularPosicoesEventosDoDia", () => {
  it("ignora eventos de dia inteiro e de outros dias", () => {
    const posicoes = calcularPosicoesEventosDoDia(DIA, [
      evento({ diaInteiro: true }),
      evento({ id: "2", inicioEm: "2026-07-21T10:00:00", fimEm: "2026-07-21T11:00:00" }),
    ]);
    expect(posicoes).toHaveLength(0);
  });

  it("posiciona 1 evento sozinho ocupando a coluna inteira", () => {
    const [pos] = calcularPosicoesEventosDoDia(DIA, [evento()]);
    expect(pos.coluna).toBe(0);
    expect(pos.totalColunas).toBe(1);
    expect(pos.topoPercentual).toBeCloseTo((10 * 60 / 1440) * 100, 5);
    expect(pos.alturaPercentual).toBeCloseTo((60 / 1440) * 100, 5);
  });

  it("dá altura mínima para eventos muito curtos", () => {
    const [pos] = calcularPosicoesEventosDoDia(DIA, [
      evento({ inicioEm: "2026-07-20T10:00:00", fimEm: "2026-07-20T10:05:00" }),
    ]);
    expect(pos.alturaPercentual).toBe(2.5);
  });

  it("divide em 2 colunas quando dois eventos se sobrepõem", () => {
    const posicoes = calcularPosicoesEventosDoDia(DIA, [
      evento({ id: "a", inicioEm: "2026-07-20T10:00:00", fimEm: "2026-07-20T11:00:00" }),
      evento({ id: "b", inicioEm: "2026-07-20T10:30:00", fimEm: "2026-07-20T11:30:00" }),
    ]);
    expect(posicoes).toHaveLength(2);
    expect(posicoes[0].totalColunas).toBe(2);
    expect(posicoes[1].totalColunas).toBe(2);
    expect(new Set(posicoes.map((p) => p.coluna))).toEqual(new Set([0, 1]));
  });

  it("reutiliza a mesma coluna para eventos consecutivos que não se sobrepõem", () => {
    const posicoes = calcularPosicoesEventosDoDia(DIA, [
      evento({ id: "a", inicioEm: "2026-07-20T09:00:00", fimEm: "2026-07-20T10:00:00" }),
      evento({ id: "b", inicioEm: "2026-07-20T10:00:00", fimEm: "2026-07-20T11:00:00" }),
    ]);
    expect(posicoes.every((p) => p.totalColunas === 1)).toBe(true);
  });

  it("cria 3 colunas quando 3 eventos se sobrepõem entre si", () => {
    const posicoes = calcularPosicoesEventosDoDia(DIA, [
      evento({ id: "a", inicioEm: "2026-07-20T10:00:00", fimEm: "2026-07-20T12:00:00" }),
      evento({ id: "b", inicioEm: "2026-07-20T10:30:00", fimEm: "2026-07-20T11:30:00" }),
      evento({ id: "c", inicioEm: "2026-07-20T11:00:00", fimEm: "2026-07-20T11:45:00" }),
    ]);
    expect(posicoes.every((p) => p.totalColunas === 3)).toBe(true);
    expect(new Set(posicoes.map((p) => p.coluna))).toEqual(new Set([0, 1, 2]));
  });

  it("clusters separados no tempo não compartilham colunas", () => {
    const posicoes = calcularPosicoesEventosDoDia(DIA, [
      evento({ id: "a", inicioEm: "2026-07-20T08:00:00", fimEm: "2026-07-20T09:00:00" }),
      evento({ id: "b", inicioEm: "2026-07-20T08:00:00", fimEm: "2026-07-20T09:00:00" }),
      evento({ id: "c", inicioEm: "2026-07-20T15:00:00", fimEm: "2026-07-20T16:00:00" }),
    ]);
    const clusterManha = posicoes.filter((p) => p.evento.id !== "c");
    const clusterTarde = posicoes.find((p) => p.evento.id === "c")!;
    expect(clusterManha.every((p) => p.totalColunas === 2)).toBe(true);
    expect(clusterTarde.totalColunas).toBe(1);
  });
});

describe("eventosDiaInteiroDoDia", () => {
  it("retorna só os eventos de dia inteiro do dia certo", () => {
    const eventos = [
      evento({ id: "a", diaInteiro: true, inicioEm: "2026-07-20T00:00:00" }),
      evento({ id: "b", diaInteiro: true, inicioEm: "2026-07-21T00:00:00" }),
      evento({ id: "c", diaInteiro: false }),
    ];
    const resultado = eventosDiaInteiroDoDia(DIA, eventos);
    expect(resultado.map((e) => e.id)).toEqual(["a"]);
  });
});
