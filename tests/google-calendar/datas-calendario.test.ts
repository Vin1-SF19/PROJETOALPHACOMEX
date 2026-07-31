import { describe, expect, it } from "vitest";

import {
  agruparPorDia,
  calcularIntervaloVisao,
  dataAnterior,
  diasDaSemana,
  diasDoGridMes,
  formatarDataCivil,
  mesesDoAno,
  mesmodia,
  parsearDataCivil,
  proximaData,
} from "@/components/CalendarioAlpha/lib/datas";

function dataCivil(valor: string): Date {
  const data = parsearDataCivil(valor);
  if (!data) throw new Error(`Data civil inválida no teste: ${valor}`);
  return data;
}

describe("data civil em America/Sao_Paulo", () => {
  it("interpreta YYYY-MM-DD à meia-noite de São Paulo mesmo se o processo estiver em UTC", () => {
    expect(dataCivil("2026-07-31").toISOString()).toBe("2026-07-31T03:00:00.000Z");
  });

  it("serializa o instante pela data civil de São Paulo", () => {
    expect(formatarDataCivil(new Date("2026-08-01T01:59:59.000Z"))).toBe("2026-07-31");
    expect(formatarDataCivil(new Date("2026-08-01T03:00:00.000Z"))).toBe("2026-08-01");
  });

  it("aceita dia bissexto válido", () => {
    const data = parsearDataCivil("2024-02-29");
    expect(data && formatarDataCivil(data)).toBe("2024-02-29");
  });

  it("resolve meia-noite inexistente para o primeiro instante válido da data", () => {
    const data = dataCivil("2018-11-04");
    expect(data.toISOString()).toBe("2018-11-04T03:00:00.000Z");
    expect(formatarDataCivil(data)).toBe("2018-11-04");
  });

  it.each(["2026-02-29", "2026-04-31", "2026-13-01", "2026-00-10", "31-07-2026", ""])(
    "rejeita data impossível ou fora do formato: %s",
    (valor) => {
      expect(parsearDataCivil(valor)).toBeNull();
    },
  );
});

describe("calcularIntervaloVisao", () => {
  it("dia: usa as duas meias-noites consecutivas de São Paulo", () => {
    const { inicio, fim } = calcularIntervaloVisao("dia", dataCivil("2026-07-31"));
    expect(inicio.toISOString()).toBe("2026-07-31T03:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-08-01T03:00:00.000Z");
  });

  it("semana: intervalo de domingo a domingo seguinte", () => {
    const { inicio, fim } = calcularIntervaloVisao("semana", dataCivil("2026-07-18")); // sábado
    expect(formatarDataCivil(inicio)).toBe("2026-07-12");
    expect(formatarDataCivil(fim)).toBe("2026-07-19");
    expect(fim.getTime() - inicio.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("mês: inclui dias de preenchimento do mês anterior/seguinte para fechar o grid semanal", () => {
    // Julho/2026 começa numa quarta-feira — o grid deve incluir dom/seg/ter de junho.
    const { inicio, fim } = calcularIntervaloVisao("mes", dataCivil("2026-07-15"));
    expect(formatarDataCivil(inicio)).toBe("2026-06-28");
    expect(formatarDataCivil(fim)).toBe("2026-08-02");
  });

  it("ano: 1º de janeiro a 1º de janeiro do ano seguinte", () => {
    const { inicio, fim } = calcularIntervaloVisao("ano", dataCivil("2026-07-18"));
    expect(inicio.toISOString()).toBe("2026-01-01T03:00:00.000Z");
    expect(fim.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });
});

describe("navegação (próxima/anterior)", () => {
  it("dia anda 1 dia por vez", () => {
    const base = dataCivil("2026-07-18");
    expect(formatarDataCivil(proximaData("dia", base))).toBe("2026-07-19");
    expect(formatarDataCivil(dataAnterior("dia", base))).toBe("2026-07-17");
  });

  it("semana anda em blocos de 7 dias", () => {
    const base = dataCivil("2026-07-18");
    expect(formatarDataCivil(proximaData("semana", base))).toBe("2026-07-25");
    expect(formatarDataCivil(dataAnterior("semana", base))).toBe("2026-07-11");
  });

  it("mês anda para o dia 1 do mês seguinte/anterior", () => {
    const base = dataCivil("2026-07-18");
    expect(proximaData("mes", base).toISOString()).toBe("2026-08-01T03:00:00.000Z");
    expect(dataAnterior("mes", base).toISOString()).toBe("2026-06-01T03:00:00.000Z");
  });

  it("ano anda para o ano seguinte/anterior", () => {
    const base = dataCivil("2026-07-18");
    expect(formatarDataCivil(proximaData("ano", base))).toBe("2027-07-01");
    expect(formatarDataCivil(dataAnterior("ano", base))).toBe("2025-07-01");
  });

  it("progride monotonicamente ao atravessar o início histórico do horário de verão", () => {
    const diaTres = dataCivil("2018-11-03");
    const diaQuatro = proximaData("dia", diaTres);
    const diaCinco = proximaData("dia", diaQuatro);

    expect(formatarDataCivil(diaQuatro)).toBe("2018-11-04");
    expect(diaQuatro.toISOString()).toBe("2018-11-04T03:00:00.000Z");
    expect(formatarDataCivil(diaCinco)).toBe("2018-11-05");
    expect(diaCinco.toISOString()).toBe("2018-11-05T02:00:00.000Z");
    expect(diaQuatro.getTime()).toBeGreaterThan(diaTres.getTime());
    expect(diaCinco.getTime()).toBeGreaterThan(diaQuatro.getTime());
  });
});

describe("diasDoGridMes", () => {
  it("todo grid é múltiplo de 7 dias e começa num domingo", () => {
    const dias = diasDoGridMes(dataCivil("2026-07-15"));
    expect(dias.length % 7).toBe(0);
    expect(formatarDataCivil(dias[0])).toBe("2026-06-28");
    expect(formatarDataCivil(dias[dias.length - 1])).toBe("2026-08-01");
  });

  it("termina o grid que atravessa uma meia-noite inexistente", () => {
    const dias = diasDoGridMes(dataCivil("2018-11-15"));
    expect(dias.length % 7).toBe(0);
    expect(dias.map(formatarDataCivil)).toContain("2018-11-04");
    expect(new Set(dias.map(formatarDataCivil)).size).toBe(dias.length);
  });
});

describe("diasDaSemana", () => {
  it("retorna 7 dias começando no domingo", () => {
    const dias = diasDaSemana(dataCivil("2026-07-18")); // sábado
    expect(dias).toHaveLength(7);
    expect(formatarDataCivil(dias[0])).toBe("2026-07-12");
    expect(formatarDataCivil(dias[6])).toBe("2026-07-18");
  });
});

describe("mesesDoAno", () => {
  it("retorna o dia 1 dos 12 meses do ano da data de referência", () => {
    const meses = mesesDoAno(dataCivil("2026-07-18"));
    expect(meses).toHaveLength(12);
    expect(meses[0].toISOString()).toBe("2026-01-01T03:00:00.000Z");
    expect(meses[11].toISOString()).toBe("2026-12-01T03:00:00.000Z");
  });
});

describe("mesmodia", () => {
  it("compara ano/mês/dia ignorando hora", () => {
    expect(mesmodia(new Date("2026-07-18T03:00:00.000Z"), new Date("2026-07-19T02:59:59.000Z"))).toBe(true);
    expect(mesmodia(new Date("2026-07-19T02:59:59.000Z"), new Date("2026-07-19T03:00:00.000Z"))).toBe(false);
  });
});

describe("agruparPorDia", () => {
  it("ignora eventos sem inicioEm e agrupa os demais pela data de São Paulo", () => {
    const eventos = [
      { inicioEm: "2026-08-01T01:30:00.000Z" },
      { inicioEm: "2026-07-31T14:00:00.000Z" },
      { inicioEm: null },
      { inicioEm: "2026-08-01T03:30:00.000Z" },
    ];
    const mapa = agruparPorDia(eventos);
    expect(mapa.get("2026-07-31")).toHaveLength(2);
    expect(mapa.get("2026-08-01")).toHaveLength(1);
    expect(mapa.size).toBe(2);
  });
});
