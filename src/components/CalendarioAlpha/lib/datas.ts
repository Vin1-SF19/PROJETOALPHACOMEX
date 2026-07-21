export type VisaoCalendario = "dia" | "semana" | "mes" | "ano";

export function inicioDoDia(data: Date): Date {
  const copia = new Date(data);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

export function adicionarDias(data: Date, dias: number): Date {
  const copia = new Date(data);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

function inicioDaSemana(data: Date): Date {
  return inicioDoDia(adicionarDias(data, -data.getDay()));
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

  if (visao === "ano") {
    const inicio = new Date(dataReferencia.getFullYear(), 0, 1);
    const fim = new Date(dataReferencia.getFullYear() + 1, 0, 1);
    return { inicio, fim };
  }

  const primeiroDiaMes = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth(), 1);
  const ultimoDiaMes = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth() + 1, 0);
  const inicioGrid = adicionarDias(primeiroDiaMes, -primeiroDiaMes.getDay());
  const fimGrid = adicionarDias(ultimoDiaMes, 6 - ultimoDiaMes.getDay());

  return { inicio: inicioDoDia(inicioGrid), fim: adicionarDias(inicioDoDia(fimGrid), 1) };
}

export function proximaData(visao: VisaoCalendario, dataReferencia: Date): Date {
  if (visao === "dia") return adicionarDias(dataReferencia, 1);
  if (visao === "semana") return adicionarDias(dataReferencia, 7);
  if (visao === "ano") return new Date(dataReferencia.getFullYear() + 1, dataReferencia.getMonth(), 1);
  return new Date(dataReferencia.getFullYear(), dataReferencia.getMonth() + 1, 1);
}

export function dataAnterior(visao: VisaoCalendario, dataReferencia: Date): Date {
  if (visao === "dia") return adicionarDias(dataReferencia, -1);
  if (visao === "semana") return adicionarDias(dataReferencia, -7);
  if (visao === "ano") return new Date(dataReferencia.getFullYear() - 1, dataReferencia.getMonth(), 1);
  return new Date(dataReferencia.getFullYear(), dataReferencia.getMonth() - 1, 1);
}

/** Todos os dias visíveis no grid do mês, incluindo os dias de preenchimento do mês anterior/seguinte. */
export function diasDoGridMes(dataReferencia: Date): Date[] {
  const primeiroDiaMes = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth(), 1);
  const ultimoDiaMes = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth() + 1, 0);
  const inicioGrid = inicioDoDia(adicionarDias(primeiroDiaMes, -primeiroDiaMes.getDay()));
  const fimGrid = inicioDoDia(adicionarDias(ultimoDiaMes, 6 - ultimoDiaMes.getDay()));

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
  return Array.from({ length: 12 }, (_, mes) => new Date(dataReferencia.getFullYear(), mes, 1));
}

export function mesmodia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function agruparPorDia<T extends { inicioEm: Date | string | null }>(eventos: T[]): Map<string, T[]> {
  const mapa = new Map<string, T[]>();
  for (const evento of eventos) {
    if (!evento.inicioEm) continue;
    const chave = inicioDoDia(new Date(evento.inicioEm)).toISOString().slice(0, 10);
    const lista = mapa.get(chave) ?? [];
    lista.push(evento);
    mapa.set(chave, lista);
  }
  return mapa;
}

const FORMATADOR_TITULO_MES = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const FORMATADOR_TITULO_DIA = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
const FORMATADOR_DIA_MES_CURTO = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const FORMATADOR_HORA = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const FORMATADOR_MES_CURTO = new Intl.DateTimeFormat("pt-BR", { month: "long" });
const FORMATADOR_DIA_SEMANA_CURTO = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });

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
  if (primeiro.getMonth() === ultimo.getMonth()) {
    return `${primeiro.getDate()} – ${FORMATADOR_DIA_MES_CURTO.format(ultimo)}`;
  }
  return `${FORMATADOR_DIA_MES_CURTO.format(primeiro)} – ${FORMATADOR_DIA_MES_CURTO.format(ultimo)}`;
}

export function formatarTituloAno(data: Date): string {
  return String(data.getFullYear());
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
