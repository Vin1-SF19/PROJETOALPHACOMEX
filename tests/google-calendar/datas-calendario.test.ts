import { describe, expect, it } from "vitest";

import {
  agruparPorDia,
  calcularIntervaloVisao,
  dataAnterior,
  diasDaSemana,
  diasDoGridMes,
  mesesDoAno,
  mesmodia,
  proximaData,
} from "@/components/CalendarioAlpha/lib/datas";

describe("calcularIntervaloVisao", () => {
  it("dia: intervalo de 24h a partir da meia-noite da data de referência", () => {
    const { inicio, fim } = calcularIntervaloVisao("dia", new Date("2026-07-18T15:30:00"));
    expect(inicio.toISOString().slice(0, 10)).toBe("2026-07-18");
    expect(fim.toISOString().slice(0, 10)).toBe("2026-07-19");
  });

  it("semana: intervalo de domingo a domingo seguinte", () => {
    const { inicio, fim } = calcularIntervaloVisao("semana", new Date("2026-07-18")); // sábado
    expect(inicio.getDay()).toBe(0);
    expect(fim.getTime() - inicio.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("mês: inclui dias de preenchimento do mês anterior/seguinte para fechar o grid semanal", () => {
    // Julho/2026 começa numa quarta-feira — o grid deve incluir dom/seg/ter de junho.
    const { inicio, fim } = calcularIntervaloVisao("mes", new Date("2026-07-15"));
    expect(inicio.getDay()).toBe(0); // grid sempre começa num domingo
    expect(fim.getDay() === 1 || fim > new Date("2026-07-31")).toBeTruthy();
  });

  it("ano: 1º de janeiro a 1º de janeiro do ano seguinte", () => {
    const { inicio, fim } = calcularIntervaloVisao("ano", new Date("2026-07-18"));
    expect(inicio).toEqual(new Date(2026, 0, 1));
    expect(fim).toEqual(new Date(2027, 0, 1));
  });
});

describe("navegação (próxima/anterior)", () => {
  it("dia anda 1 dia por vez", () => {
    const base = new Date("2026-07-18");
    expect(proximaData("dia", base).toISOString().slice(0, 10)).toBe("2026-07-19");
    expect(dataAnterior("dia", base).toISOString().slice(0, 10)).toBe("2026-07-17");
  });

  it("semana anda em blocos de 7 dias", () => {
    const base = new Date("2026-07-18");
    expect(proximaData("semana", base).toISOString().slice(0, 10)).toBe("2026-07-25");
    expect(dataAnterior("semana", base).toISOString().slice(0, 10)).toBe("2026-07-11");
  });

  it("mês anda para o dia 1 do mês seguinte/anterior", () => {
    const base = new Date("2026-07-18");
    expect(proximaData("mes", base)).toEqual(new Date(2026, 7, 1));
    expect(dataAnterior("mes", base)).toEqual(new Date(2026, 5, 1));
  });

  it("ano anda para o ano seguinte/anterior", () => {
    const base = new Date("2026-07-18");
    expect(proximaData("ano", base).getFullYear()).toBe(2027);
    expect(dataAnterior("ano", base).getFullYear()).toBe(2025);
  });
});

describe("diasDoGridMes", () => {
  it("todo grid é múltiplo de 7 dias e começa num domingo", () => {
    const dias = diasDoGridMes(new Date("2026-07-15"));
    expect(dias.length % 7).toBe(0);
    expect(dias[0].getDay()).toBe(0);
    expect(dias[dias.length - 1].getDay()).toBe(6);
  });
});

describe("diasDaSemana", () => {
  it("retorna 7 dias começando no domingo", () => {
    const dias = diasDaSemana(new Date("2026-07-18")); // sábado
    expect(dias).toHaveLength(7);
    expect(dias[0].getDay()).toBe(0);
    expect(dias[6].getDay()).toBe(6);
  });
});

describe("mesesDoAno", () => {
  it("retorna o dia 1 dos 12 meses do ano da data de referência", () => {
    const meses = mesesDoAno(new Date("2026-07-18"));
    expect(meses).toHaveLength(12);
    expect(meses[0]).toEqual(new Date(2026, 0, 1));
    expect(meses[11]).toEqual(new Date(2026, 11, 1));
  });
});

describe("mesmodia", () => {
  it("compara ano/mês/dia ignorando hora", () => {
    expect(mesmodia(new Date("2026-07-18T02:00:00"), new Date("2026-07-18T23:00:00"))).toBe(true);
    expect(mesmodia(new Date("2026-07-18"), new Date("2026-07-19"))).toBe(false);
  });
});

describe("agruparPorDia", () => {
  it("ignora eventos sem inicioEm e agrupa os demais pela data local", () => {
    const eventos = [
      { inicioEm: "2026-07-18T14:00:00" },
      { inicioEm: "2026-07-18T09:00:00" },
      { inicioEm: null },
      { inicioEm: "2026-07-19T10:00:00" },
    ];
    const mapa = agruparPorDia(eventos);
    expect(mapa.get("2026-07-18")).toHaveLength(2);
    expect(mapa.get("2026-07-19")).toHaveLength(1);
    expect(mapa.size).toBe(2);
  });
});
