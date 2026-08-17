import type { GoogleEventoDataDTO, GoogleEventoDTO } from "./types";

const PADRAO_DATA_CIVIL = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Converte o par `{dataHora, data}` de um evento do Google em `Date`.
 *
 * Eventos "dia inteiro" chegam só em `data` (`"YYYY-MM-DD"`, sem horário/offset).
 * `new Date("YYYY-MM-DD")` interpreta essa string como meia-noite **UTC**; ao
 * formatar depois em `America/Sao_Paulo` (UTC-3) — como faz `formatarDataCivil`
 * em `CalendarioAlpha/lib/datas.ts`, via `getUTCFullYear/Month/Date` — ela regride
 * para o dia civil anterior (feriado do dia 9 aparecendo no dia 8, por exemplo).
 * Por isso a data civil pura é ancorada explicitamente em `Date.UTC`, mesmo
 * padrão de `civilDate()` em `src/lib/commissions/calendar-engine.ts`.
 */
export function paraDataDeEventoOuNull(detalhe: GoogleEventoDataDTO): Date | null {
  if (detalhe.dataHora) return new Date(detalhe.dataHora);

  if (detalhe.data) {
    const partes = PADRAO_DATA_CIVIL.exec(detalhe.data);
    if (partes) {
      const [, ano, mes, dia] = partes;
      return new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
    }
    return new Date(detalhe.data);
  }

  return null;
}

/** Campos persistidos em `GoogleCalendarEventoCache` a partir de um DTO do Google — única fonte, usada por sync e pelas actions de CRUD. */
export function dadosCacheDeEvento(evento: GoogleEventoDTO) {
  return {
    status: evento.status,
    titulo: evento.titulo,
    inicioEm: paraDataDeEventoOuNull(evento.inicio),
    fimEm: paraDataDeEventoOuNull(evento.fim),
    diaInteiro: evento.diaInteiro,
    etag: evento.etag,
    linkMeet: evento.linkMeet,
    atualizadoGoogleEm: new Date(evento.atualizadoEm),
  };
}
