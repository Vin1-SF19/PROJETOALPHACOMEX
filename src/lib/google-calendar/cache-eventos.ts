import type { GoogleEventoDTO } from "./types";

export function paraDataOuNull(valor: string | undefined): Date | null {
  return valor ? new Date(valor) : null;
}

/** Campos persistidos em `GoogleCalendarEventoCache` a partir de um DTO do Google — única fonte, usada por sync e pelas actions de CRUD. */
export function dadosCacheDeEvento(evento: GoogleEventoDTO) {
  return {
    status: evento.status,
    titulo: evento.titulo,
    inicioEm: paraDataOuNull(evento.inicio.dataHora ?? evento.inicio.data),
    fimEm: paraDataOuNull(evento.fim.dataHora ?? evento.fim.data),
    diaInteiro: evento.diaInteiro,
    etag: evento.etag,
    linkMeet: evento.linkMeet,
    atualizadoGoogleEm: new Date(evento.atualizadoEm),
  };
}
