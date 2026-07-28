import { describe, expect, it } from "vitest";
import {
  civilDate,
  isDiaUtil,
  mesSeguinte,
  quintoDiaUtil,
  sextaFeiraDaSemanaSeguinte,
  toISODateString,
  ultimaSextaFeira,
  ultimoDiaCivil,
  ultimoDiaUtil,
} from "@/lib/commissions/calendar-engine";
import { feriadosNacionais } from "@/lib/commissions/holidays-seed";

describe("feriadosNacionais — 2026", () => {
  const feriados = feriadosNacionais(2026);

  it("inclui os 8 feriados fixos", () => {
    const nomes = feriados.map((f) => f.nome);
    expect(nomes).toContain("Confraternização Universal");
    expect(nomes).toContain("Tiradentes");
    expect(nomes).toContain("Dia do Trabalho");
    expect(nomes).toContain("Independência do Brasil");
    expect(nomes).toContain("Nossa Senhora Aparecida");
    expect(nomes).toContain("Finados");
    expect(nomes).toContain("Proclamação da República");
    expect(nomes).toContain("Natal");
  });

  it("inclui os 3 feriados móveis (Carnaval, Sexta-feira Santa, Corpus Christi)", () => {
    const nomes = feriados.map((f) => f.nome);
    expect(nomes).toContain("Carnaval");
    expect(nomes).toContain("Sexta-feira Santa");
    expect(nomes).toContain("Corpus Christi");
  });

  it("Natal 2026 cai em 25/12", () => {
    const natal = feriados.find((f) => f.nome === "Natal");
    expect(natal?.data).toBe("2026-12-25");
  });

  it("Tiradentes 2026 cai em 21/04", () => {
    const tiradentes = feriados.find((f) => f.nome === "Tiradentes");
    expect(tiradentes?.data).toBe("2026-04-21");
  });
});

describe("quintoDiaUtil — atravessando feriado nacional", () => {
  it("janeiro de 2026: 01/01 é feriado (Confraternização Universal, quinta-feira)", () => {
    const holidays = feriadosNacionais(2026);
    // Jan/2026: dia 1 = quinta (feriado), dia 2 = sexta útil (1º dia útil),
    // dia 3 = sábado, dia 4 = domingo, dia 5 = segunda (2º dia útil),
    // dia 6 = terça (3º), dia 7 = quarta (4º), dia 8 = quinta (5º dia útil).
    const resultado = quintoDiaUtil(2026, 1, holidays);
    expect(toISODateString(resultado)).toBe("2026-01-08");
  });

  it("sem feriados, quinto dia útil de um mês que começa numa segunda-feira", () => {
    // Junho/2026 começa numa segunda-feira (01/06/2026).
    const resultado = quintoDiaUtil(2026, 6, []);
    expect(toISODateString(resultado)).toBe("2026-06-05");
  });

  it("isDiaUtil retorna false em feriado nacional e em fim de semana", () => {
    const holidays = feriadosNacionais(2026);
    expect(isDiaUtil(civilDate(2026, 1, 1), holidays)).toBe(false); // feriado
    expect(isDiaUtil(civilDate(2026, 1, 3), holidays)).toBe(false); // sábado
    expect(isDiaUtil(civilDate(2026, 1, 2), holidays)).toBe(true); // sexta útil
  });
});

describe("ultimaSextaFeira", () => {
  it("última sexta-feira de julho de 2026", () => {
    const resultado = ultimaSextaFeira(2026, 7);
    expect(toISODateString(resultado)).toBe("2026-07-31");
    expect(resultado.getUTCDay()).toBe(5);
  });

  it("última sexta-feira de fevereiro de 2026 (mês de 28 dias)", () => {
    const resultado = ultimaSextaFeira(2026, 2);
    expect(resultado.getUTCDay()).toBe(5);
    expect(toISODateString(resultado)).toBe("2026-02-27");
  });
});

describe("sextaFeiraDaSemanaSeguinte", () => {
  it("a partir de uma terça-feira, cai na sexta da semana seguinte", () => {
    const terca = civilDate(2026, 7, 28); // 28/07/2026 é uma terça-feira
    const resultado = sextaFeiraDaSemanaSeguinte(terca);
    expect(resultado.getUTCDay()).toBe(5);
    expect(toISODateString(resultado)).toBe("2026-08-07");
  });
});

describe("virada de mês/ano", () => {
  it("mesSeguinte trata dezembro → janeiro do ano seguinte", () => {
    expect(mesSeguinte(2026, 12)).toEqual({ year: 2027, month: 1 });
  });

  it("mesSeguinte em mês comum apenas incrementa", () => {
    expect(mesSeguinte(2026, 6)).toEqual({ year: 2026, month: 7 });
  });

  it("ultimoDiaCivil de fevereiro em ano não-bissexto (2026) é 28", () => {
    const resultado = ultimoDiaCivil(2026, 2);
    expect(toISODateString(resultado)).toBe("2026-02-28");
  });

  it("ultimoDiaUtil retrocede a partir do último dia civil quando cai em fim de semana/feriado", () => {
    // Dezembro/2026: dia 31 é uma quinta-feira útil normal (25/12 é feriado, mas é outro dia).
    const resultado = ultimoDiaUtil(2026, 12, feriadosNacionais(2026));
    expect(toISODateString(resultado)).toBe("2026-12-31");
  });
});
