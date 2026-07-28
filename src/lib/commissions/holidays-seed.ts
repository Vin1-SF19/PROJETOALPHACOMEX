import { civilDate, toISODateString } from "./calendar-engine";
import type { HolidayRecord } from "./calendar-engine";

/**
 * Feriados NACIONAIS brasileiros — data determinística, sem API externa.
 * Feriados ESTADUAIS/MUNICIPAIS ficam de fora por decisão consciente (seção 39 do prompt
 * original, "feriados municipais é decisão que não deve ser inventada") — o model `Holiday`
 * (schema aplicado na Fase 02) suporta esses escopos, mas nenhuma linha estadual/municipal
 * é populada aqui. Cadastrar via Configurações (Fase 14) quando a gestão confirmar quais
 * municípios/estados importam para o cálculo de calendário.
 */

/** Domingo de Páscoa via algoritmo de Gauss/Meeus (calendário gregoriano). */
function domingoDePascoa(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return civilDate(year, month, day);
}

function addDaysToCivil(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Gera os feriados nacionais brasileiros determinísticos para um ano específico. */
export function feriadosNacionais(year: number): HolidayRecord[] {
  const pascoa = domingoDePascoa(year);
  const carnaval = addDaysToCivil(pascoa, -47); // terça-feira de carnaval
  const sextaSanta = addDaysToCivil(pascoa, -2);
  const corpusChristi = addDaysToCivil(pascoa, 60);

  const fixos: Array<[number, number, string]> = [
    [1, 1, "Confraternização Universal"],
    [4, 21, "Tiradentes"],
    [5, 1, "Dia do Trabalho"],
    [9, 7, "Independência do Brasil"],
    [10, 12, "Nossa Senhora Aparecida"],
    [11, 2, "Finados"],
    [11, 15, "Proclamação da República"],
    [12, 25, "Natal"],
  ];

  const moveis: Array<[Date, string]> = [
    [carnaval, "Carnaval"],
    [sextaSanta, "Sexta-feira Santa"],
    [corpusChristi, "Corpus Christi"],
  ];

  const registros: HolidayRecord[] = fixos.map(([month, day, nome]) => ({
    data: toISODateString(civilDate(year, month, day)),
    nome,
    escopo: "NACIONAL",
  }));

  for (const [data, nome] of moveis) {
    registros.push({ data: toISODateString(data), nome, escopo: "NACIONAL" });
  }

  return registros.sort((a, b) => a.data.localeCompare(b.data));
}

/** Feriados nacionais para um intervalo de anos (útil para calendários que cruzam virada de ano). */
export function feriadosNacionaisIntervalo(anoInicial: number, anoFinal: number): HolidayRecord[] {
  const resultado: HolidayRecord[] = [];
  for (let year = anoInicial; year <= anoFinal; year++) {
    resultado.push(...feriadosNacionais(year));
  }
  return resultado;
}
