/**
 * Motor de calendário (seção 14 do prompt original). Timezone alvo: America/Sao_Paulo.
 *
 * Decisão de implementação: todas as funções operam sobre datas CIVIS (ano/mês/dia),
 * representadas internamente como UTC à meia-noite (mesmo truque de `dataInputParaDate()`
 * do Alpha Blueprint, ver `components.md`) para evitar deslocamento de dia por fuso
 * horário em cálculos de "quinto dia útil"/"última sexta-feira" etc. — esses cálculos são
 * sobre o CALENDÁRIO CIVIL brasileiro, não sobre um instante com hora. Formatação para
 * exibição usa `Intl.DateTimeFormat` com `timeZone: "America/Sao_Paulo"`, mesmo padrão já
 * usado em `src/lib/format-date.ts`. Nenhuma dependência nova instalada — date-fns/dayjs
 * já estão no projeto, mas os cálculos de calendário civil aqui são simples o suficiente
 * para não precisar delas.
 *
 * Feriados estaduais/municipais NÃO são populados por padrão — decisão que não deve ser
 * inventada (seção 39). Ver `holidays-seed.ts`.
 */

export interface HolidayRecord {
  /** Data civil do feriado, formato "YYYY-MM-DD". */
  data: string;
  nome: string;
  escopo: "NACIONAL" | "ESTADUAL" | "MUNICIPAL";
}

/** Cria uma data civil (UTC à meia-noite) a partir de ano/mês(1-12)/dia. */
export function civilDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/** Extrai {year, month, day} de uma data civil UTC. */
export function toCivilParts(date: Date): { year: number; month: number; day: number } {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function civilDateFromISO(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return civilDate(year, month, day);
}

export function toISODateString(date: Date): string {
  const { year, month, day } = toCivilParts(date);
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function isSameCivilDate(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate();
}

function isHoliday(date: Date, holidays: HolidayRecord[]): boolean {
  return holidays.some((h) => isSameCivilDate(civilDateFromISO(h.data), date));
}

/** Domingo = 0, Sábado = 6 (getUTCDay, consistente com data civil UTC). */
function isWeekend(date: Date): boolean {
  const dow = date.getUTCDay();
  return dow === 0 || dow === 6;
}

export function isDiaUtil(date: Date, holidays: HolidayRecord[]): boolean {
  return !isWeekend(date) && !isHoliday(date, holidays);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Último dia civil do mês (ex: 30/04, 31/05, considerando ano bissexto em fevereiro). */
export function ultimoDiaCivil(year: number, month: number): Date {
  // Dia 0 do mês seguinte = último dia do mês atual.
  return new Date(Date.UTC(year, month, 0));
}

/** Último dia ÚTIL do mês (retrocede a partir do último dia civil, pulando fim de semana/feriado). */
export function ultimoDiaUtil(year: number, month: number, holidays: HolidayRecord[] = []): Date {
  let d = ultimoDiaCivil(year, month);
  while (!isDiaUtil(d, holidays)) {
    d = addDays(d, -1);
  }
  return d;
}

/**
 * Quinto dia útil do mês, avançando a partir do dia 1 e pulando fins de semana/feriados.
 * `year`/`month` referem-se ao mês em que se conta os dias úteis (ex: para "5º dia útil do
 * mês seguinte ao evento", o chamador já deve passar month+1).
 */
export function quintoDiaUtil(year: number, month: number, holidays: HolidayRecord[] = []): Date {
  let d = civilDate(year, month, 1);
  let count = 0;
  while (count < 5) {
    if (isDiaUtil(d, holidays)) count++;
    if (count < 5) d = addDays(d, 1);
  }
  return d;
}

/** Última sexta-feira do mês (independente de ser feriado — é sobre dia da semana, não dia útil). */
export function ultimaSextaFeira(year: number, month: number): Date {
  let d = ultimoDiaCivil(year, month);
  while (d.getUTCDay() !== 5) {
    d = addDays(d, -1);
  }
  return d;
}

/** Sexta-feira da semana seguinte à data informada. */
export function sextaFeiraDaSemanaSeguinte(date: Date): Date {
  // Avança 7 dias para "semana seguinte", depois ajusta até cair numa sexta-feira.
  let d = addDays(date, 7);
  const diasAteProximaSexta = (5 - d.getUTCDay() + 7) % 7;
  d = addDays(d, diasAteProximaSexta);
  return d;
}

/** Retorna {year, month} do mês seguinte ao informado (trata virada de ano). */
export function mesSeguinte(year: number, month: number): { year: number; month: number } {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

/** Domingo, "dow"=0 (getUTCDay). Sábado NÃO conta como dia de descanso (confirmado pelo usuário — só domingo + feriados). */
function isDomingo(date: Date): boolean {
  return date.getUTCDay() === 0;
}

/**
 * Conta dias úteis e "dias de descanso" (domingos + feriados nacionais/estaduais/
 * municipais) de um mês inteiro — usado pela fórmula de DSR (seção do prompt confirmada
 * pelo usuário: "considera-se domingos e feriados, NÃO se considera sábados"). `holidays`
 * deve incluir os feriados relevantes para a UF/município do colaborador (ex: Balneário
 * Camboriú/SC) além dos nacionais — resolvido pelo chamador.
 */
export function contarDiasUteisEDescansoDoMes(year: number, month: number, holidays: HolidayRecord[] = []): { diasUteis: number; diasDescanso: number } {
  const ultimoDia = ultimoDiaCivil(year, month).getUTCDate();
  let diasDescanso = 0;

  for (let day = 1; day <= ultimoDia; day++) {
    const data = civilDate(year, month, day);
    if (isDomingo(data) || isHoliday(data, holidays)) {
      diasDescanso++;
    }
  }

  return { diasUteis: ultimoDia - diasDescanso, diasDescanso };
}
