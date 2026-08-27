/** Par de tokens retornado pelo Google — nunca trafega para Client Components. */
export interface TokenBundleGoogle {
  accessToken: string;
  /** Ausente quando o Google não devolve um novo refresh token numa reconexão — o anterior deve ser preservado. */
  refreshToken?: string;
  /** Epoch ms de expiração do access token. */
  expiryDate: number;
  scope: string;
}

export interface GoogleCalendarioDTO {
  googleCalendarId: string;
  nome: string;
  corHex: string | null;
  timezone: string;
  papelAcesso: "owner" | "writer" | "reader" | "freeBusyReader";
  principal: boolean;
}

export interface GoogleEventoParticipanteDTO {
  email: string;
  nome: string | null;
  status: "needsAction" | "accepted" | "declined" | "tentative";
  organizador: boolean;
}

export interface GoogleEventoConferenciaDTO {
  videoUrl: string | null;
  telefones: string[];
}

export interface GoogleEventoDataDTO {
  /** Presente em eventos com horário (`dateTime` do Google). */
  dataHora?: string;
  /** Presente em eventos de dia inteiro (`date` do Google, formato YYYY-MM-DD). */
  data?: string;
  timezone?: string;
}

export type GoogleEventType =
  | "default"
  | "focusTime"
  | "outOfOffice"
  | "workingLocation"
  | "birthday"
  | "fromGmail";

export interface GoogleEventoDTO {
  googleEventId: string;
  status: "confirmed" | "tentative" | "cancelled";
  titulo: string | null;
  descricao: string | null;
  localizacao: string | null;
  inicio: GoogleEventoDataDTO;
  fim: GoogleEventoDataDTO;
  diaInteiro: boolean;
  recorrenciaRegras: string[] | null;
  /** Preenchido quando este DTO representa uma instância de um evento recorrente. */
  eventoRecorrenteIdOrigem: string | null;
  participantes: GoogleEventoParticipanteDTO[];
  conferencia: GoogleEventoConferenciaDTO | null;
  linkMeet: string | null;
  etag: string;
  atualizadoEm: string;
  visibilidade: "default" | "public" | "private" | "confidential";
  eventType: GoogleEventType;
  /** Propriedades de status serializadas para o cache; o Google segue sendo a fonte de verdade. */
  statusPropertiesJson: string | null;
}

export interface ResultadoPaginaEventos {
  eventos: GoogleEventoDTO[];
  proximoPageToken: string | null;
  /** Só vem preenchido na última página — deve ser persistido somente após o sync inteiro ter sucesso. */
  proximoSyncToken: string | null;
}

export interface FreeBusyIntervaloDTO {
  inicio: string;
  fim: string;
}

export interface FreeBusyResultadoDTO {
  [googleCalendarId: string]: {
    ocupado: FreeBusyIntervaloDTO[];
    erro?: string;
  };
}

export interface CriarOuAtualizarEventoInput {
  titulo: string;
  descricaoGoogle?: string;
  localizacao?: string;
  timezone: string;
  diaInteiro: boolean;
  inicio: Date;
  fim: Date;
  participantes: string[];
  criarMeet: boolean;
  eventType?: Extract<GoogleEventType, "default" | "focusTime" | "outOfOffice" | "workingLocation">;
  recorrenciaRegras?: string[];
  visibilidade?: "default" | "public" | "private" | "confidential";
  transparencia?: "opaque" | "transparent";
  lembretesMinutos?: number[];
}
