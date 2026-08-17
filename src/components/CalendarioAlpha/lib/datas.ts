export type VisaoCalendario = "dia" | "semana" | "mes" | "ano";

export const FUSO_HORARIO_AGENDA_ALPHA = "America/Sao_Paulo";

const PADRAO_DATA_CIVIL = /^(\d{4})-(\d{2})-(\d{2})$/;
const CACHE_INICIO_DATA_CIVIL = new Map<string, number>();
const LIMITE_BUSCA_DATA_CIVIL_MINUTOS = 18 * 60;

interface PartesDataCivil {
  ano: number;
  mes: number;
  dia: number;
}

const FORMATADOR_PARTES_DATA = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_HORARIO_AGENDA_ALPHA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const FORMATADOR_PARTES_INSTANTE = new Intl.DateTimeFormat("en-GB", {
  timeZone: FUSO_HORARIO_AGENDA_ALPHA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function lerPartesNumericas(
  formatador: Intl.DateTimeFormat,
  data: Date,
): PartesDataCivil & { hora: number; minuto: number; segundo: number } {
  let ano = 0;
  let mes = 0;
  let dia = 0;
  let hora = 0;
  let minuto = 0;
  let segundo = 0;

  for (const parte of formatador.formatToParts(data)) {
    const valor = Number(parte.value);
    if (parte.type === "year") ano = valor;
    if (parte.type === "month") mes = valor;
    if (parte.type === "day") dia = valor;
    if (parte.type === "hour") hora = valor;
    if (parte.type === "minute") minuto = valor;
    if (parte.type === "second") segundo = valor;
  }

  return { ano, mes, dia, hora, minuto, segundo };
}

function partesDataCivil(data: Date): PartesDataCivil {
  const { ano, mes, dia } = lerPartesNumericas(FORMATADOR_PARTES_DATA, data);
  return { ano, mes, dia };
}

function deslocamentoFusoEmMilissegundos(data: Date): number {
  const partes = lerPartesNumericas(FORMATADOR_PARTES_INSTANTE, data);
  const instanteSemFuso = Date.UTC(
    partes.ano,
    partes.mes - 1,
    partes.dia,
    partes.hora,
    partes.minuto,
    partes.segundo,
  );
  const instanteSemMilissegundos = Math.floor(data.getTime() / 1000) * 1000;
  return instanteSemFuso - instanteSemMilissegundos;
}

function dataPseudoUtc(ano: number, mesBaseZero: number, dia: number): Date {
  const data = new Date(0);
  data.setUTCHours(0, 0, 0, 0);
  data.setUTCFullYear(ano, mesBaseZero, dia);
  return data;
}

function chavePartesDataCivil({ ano, mes, dia }: PartesDataCivil): string {
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function correspondeDataCivil(
  partes: PartesDataCivil,
  ano: number,
  mes: number,
  dia: number,
): boolean {
  return partes.ano === ano && partes.mes === mes && partes.dia === dia;
}

function buscarPrimeiroInstanteDaDataCivil(
  meiaNoiteUtc: number,
  ano: number,
  mes: number,
  dia: number,
): Date {
  const minutoEmMilissegundos = 60 * 1000;
  const inicioBusca = meiaNoiteUtc - LIMITE_BUSCA_DATA_CIVIL_MINUTOS * minutoEmMilissegundos;
  const totalMinutos = LIMITE_BUSCA_DATA_CIVIL_MINUTOS * 2;

  for (let minuto = 0; minuto <= totalMinutos; minuto += 1) {
    const candidato = new Date(inicioBusca + minuto * minutoEmMilissegundos);
    if (correspondeDataCivil(partesDataCivil(candidato), ano, mes, dia)) return candidato;
  }

  throw new RangeError(
    `A data civil ${chavePartesDataCivil({ ano, mes, dia })} não existe em ${FUSO_HORARIO_AGENDA_ALPHA}.`,
  );
}

function criarDataCivil(ano: number, mes: number, dia: number): Date {
  const chave = chavePartesDataCivil({ ano, mes, dia });
  const instanteCacheado = CACHE_INICIO_DATA_CIVIL.get(chave);
  if (instanteCacheado !== undefined) return new Date(instanteCacheado);

  const meiaNoiteUtc = Date.UTC(ano, mes - 1, dia);
  const primeiroCandidato = new Date(
    meiaNoiteUtc - deslocamentoFusoEmMilissegundos(new Date(meiaNoiteUtc)),
  );
  const partesPrimeiroCandidato = lerPartesNumericas(
    FORMATADOR_PARTES_INSTANTE,
    primeiroCandidato,
  );

  if (
    correspondeDataCivil(partesPrimeiroCandidato, ano, mes, dia)
    && partesPrimeiroCandidato.hora === 0
    && partesPrimeiroCandidato.minuto === 0
  ) {
    CACHE_INICIO_DATA_CIVIL.set(chave, primeiroCandidato.getTime());
    return primeiroCandidato;
  }

  const primeiroInstanteValido = buscarPrimeiroInstanteDaDataCivil(
    meiaNoiteUtc,
    ano,
    mes,
    dia,
  );
  CACHE_INICIO_DATA_CIVIL.set(chave, primeiroInstanteValido.getTime());
  return primeiroInstanteValido;
}

function criarDataCivilNormalizada(ano: number, mesBaseZero: number, dia: number): Date {
  const data = dataPseudoUtc(ano, mesBaseZero, dia);
  return criarDataCivil(data.getUTCFullYear(), data.getUTCMonth() + 1, data.getUTCDate());
}

function diaDaSemanaCivil(data: Date): number {
  const { ano, mes, dia } = partesDataCivil(data);
  return dataPseudoUtc(ano, mes - 1, dia).getUTCDay();
}

/** Serializa uma data na data civil de São Paulo, independentemente do fuso do processo. */
export function formatarDataCivil(data: Date): string {
  const { ano, mes, dia } = partesDataCivil(data);
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Serializa a data civil UTC de uma data (sem passar pelo fuso de São Paulo).
 *
 * Eventos "dia inteiro" do Google (`inicioEm`/`fimEm` de feriados, aniversários etc.) são
 * gravados por `paraDataDeEventoOuNull` (`lib/google-calendar/cache-eventos.ts`) ancorados em
 * `Date.UTC(ano, mes, dia)` — não representam um instante real, representam a data civil pura.
 * Formatá-los com `formatarDataCivil` (fuso de São Paulo, UTC-3) subtrai 3h e cruza a
 * fronteira do dia (feriado do dia 9 caindo no dia 8). Usar esta função para esses eventos.
 */
export function formatarDataCivilUtc(data: Date): string {
  const ano = data.getUTCFullYear();
  const mes = data.getUTCMonth() + 1;
  const dia = data.getUTCDate();
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Interpreta `YYYY-MM-DD` como meia-noite em São Paulo e rejeita datas impossíveis. */
export function parsearDataCivil(valor: string | null | undefined): Date | null {
  if (!valor) return null;

  const partes = PADRAO_DATA_CIVIL.exec(valor);
  if (!partes) return null;

  const ano = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  const validacao = dataPseudoUtc(ano, mes - 1, dia);

  if (
    validacao.getUTCFullYear() !== ano
    || validacao.getUTCMonth() !== mes - 1
    || validacao.getUTCDate() !== dia
  ) {
    return null;
  }

  try {
    return criarDataCivil(ano, mes, dia);
  } catch (erro) {
    if (erro instanceof RangeError) return null;
    throw erro;
  }
}

export function inicioDoDia(data: Date): Date {
  const { ano, mes, dia } = partesDataCivil(data);
  return criarDataCivil(ano, mes, dia);
}

export function adicionarDias(data: Date, dias: number): Date {
  const partes = partesDataCivil(data);
  return criarDataCivilNormalizada(partes.ano, partes.mes - 1, partes.dia + dias);
}

function inicioDaSemana(data: Date): Date {
  return adicionarDias(inicioDoDia(data), -diaDaSemanaCivil(data));
}

/** Intervalo [inicio, fim) usado para consultar/sincronizar eventos da visão atual. */
export function calcularIntervaloVisao(visao: VisaoCalendario, dataReferencia: Date): { inicio: Date; fim: Date } {
  if (visao === "dia") {
    const inicio = inicioDoDia(dataReferencia);
    return { inicio, fim: adicionarDias(inicio, 1) };
  }

  if (visao === "semana") {
    const inicio = inicioDaSemana(dataReferencia);
    return { inicio, fim: adicionarDias(inicio, 7) };
  }

  const { ano, mes } = partesDataCivil(dataReferencia);
  if (visao === "ano") {
    return {
      inicio: criarDataCivil(ano, 1, 1),
      fim: criarDataCivil(ano + 1, 1, 1),
    };
  }

  const primeiroDiaMes = criarDataCivil(ano, mes, 1);
  const ultimoDiaMes = criarDataCivilNormalizada(ano, mes, 0);
  const inicioGrid = adicionarDias(primeiroDiaMes, -diaDaSemanaCivil(primeiroDiaMes));
  const fimGrid = adicionarDias(ultimoDiaMes, 6 - diaDaSemanaCivil(ultimoDiaMes));

  return { inicio: inicioGrid, fim: adicionarDias(fimGrid, 1) };
}

export function proximaData(visao: VisaoCalendario, dataReferencia: Date): Date {
  if (visao === "dia") return adicionarDias(dataReferencia, 1);
  if (visao === "semana") return adicionarDias(dataReferencia, 7);

  const { ano, mes } = partesDataCivil(dataReferencia);
  if (visao === "ano") return criarDataCivil(ano + 1, mes, 1);
  return criarDataCivilNormalizada(ano, mes, 1);
}

export function dataAnterior(visao: VisaoCalendario, dataReferencia: Date): Date {
  if (visao === "dia") return adicionarDias(dataReferencia, -1);
  if (visao === "semana") return adicionarDias(dataReferencia, -7);

  const { ano, mes } = partesDataCivil(dataReferencia);
  if (visao === "ano") return criarDataCivil(ano - 1, mes, 1);
  return criarDataCivilNormalizada(ano, mes - 2, 1);
}

/** Todos os dias visíveis no grid do mês, incluindo preenchimento anterior/seguinte. */
export function diasDoGridMes(dataReferencia: Date): Date[] {
  const { ano, mes } = partesDataCivil(dataReferencia);
  const primeiroDiaMes = criarDataCivil(ano, mes, 1);
  const ultimoDiaMes = criarDataCivilNormalizada(ano, mes, 0);
  const inicioGrid = adicionarDias(primeiroDiaMes, -diaDaSemanaCivil(primeiroDiaMes));
  const fimGrid = adicionarDias(ultimoDiaMes, 6 - diaDaSemanaCivil(ultimoDiaMes));

  const dias: Date[] = [];
  let cursor = inicioGrid;
  while (cursor.getTime() <= fimGrid.getTime()) {
    dias.push(cursor);
    cursor = adicionarDias(cursor, 1);
  }
  return dias;
}

/** Os 7 dias (dom-sáb) da semana que contém `dataReferencia`. */
export function diasDaSemana(dataReferencia: Date): Date[] {
  const inicio = inicioDaSemana(dataReferencia);
  return Array.from({ length: 7 }, (_, i) => adicionarDias(inicio, i));
}

/** O dia 1 de cada um dos 12 meses do ano de `dataReferencia`. */
export function mesesDoAno(dataReferencia: Date): Date[] {
  const { ano } = partesDataCivil(dataReferencia);
  return Array.from({ length: 12 }, (_, mes) => criarDataCivil(ano, mes + 1, 1));
}

export function mesmodia(a: Date, b: Date): boolean {
  return formatarDataCivil(a) === formatarDataCivil(b);
}

/** Variante de `mesmodia` para eventos "dia inteiro" — compara `a` pela data civil UTC (ver `formatarDataCivilUtc`) contra `b` pela data civil de São Paulo (grade). */
export function mesmodiaDiaInteiro(a: Date, b: Date): boolean {
  return formatarDataCivilUtc(a) === formatarDataCivil(b);
}

export function agruparPorDia<T extends { inicioEm: Date | string | null; diaInteiro?: boolean }>(
  eventos: T[],
): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const evento of eventos) {
    if (!evento.inicioEm) continue;
    const data = new Date(evento.inicioEm);
    const chave = evento.diaInteiro ? formatarDataCivilUtc(data) : formatarDataCivil(data);
    const lista = mapa.get(chave) ?? [];
    lista.push(evento);
    mapa.set(chave, lista);
  }
  return mapa;
}

const FORMATADOR_TITULO_MES = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: FUSO_HORARIO_AGENDA_ALPHA,
});
const FORMATADOR_TITULO_DIA = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  timeZone: FUSO_HORARIO_AGENDA_ALPHA,
});
const FORMATADOR_DIA_MES_CURTO = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  timeZone: FUSO_HORARIO_AGENDA_ALPHA,
});
const FORMATADOR_HORA = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: FUSO_HORARIO_AGENDA_ALPHA,
});
const FORMATADOR_MES_CURTO = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  timeZone: FUSO_HORARIO_AGENDA_ALPHA,
});
const FORMATADOR_DIA_SEMANA_CURTO = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  timeZone: FUSO_HORARIO_AGENDA_ALPHA,
});

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function formatarTituloMes(data: Date): string {
  return capitalizar(FORMATADOR_TITULO_MES.format(data));
}

export function formatarTituloDia(data: Date): string {
  return capitalizar(FORMATADOR_TITULO_DIA.format(data));
}

export function formatarTituloSemana(dataReferencia: Date): string {
  const dias = diasDaSemana(dataReferencia);
  const primeiro = dias[0];
  const ultimo = dias[6];
  const partesPrimeiro = partesDataCivil(primeiro);
  const partesUltimo = partesDataCivil(ultimo);
  if (partesPrimeiro.mes === partesUltimo.mes) {
    return `${partesPrimeiro.dia} – ${FORMATADOR_DIA_MES_CURTO.format(ultimo)}`;
  }
  return `${FORMATADOR_DIA_MES_CURTO.format(primeiro)} – ${FORMATADOR_DIA_MES_CURTO.format(ultimo)}`;
}

export function formatarTituloAno(data: Date): string {
  return String(partesDataCivil(data).ano);
}

export function formatarHora(data: Date): string {
  return FORMATADOR_HORA.format(data);
}

export function formatarMesCurto(data: Date): string {
  return capitalizar(FORMATADOR_MES_CURTO.format(data));
}

export function formatarDiaSemanaCurto(data: Date): string {
  return capitalizar(FORMATADOR_DIA_SEMANA_CURTO.format(data)).replace(".", "");
}
