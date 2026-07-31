/** Cor usada quando o Google não retorna `backgroundColor` para o calendário/evento. */
export const COR_CALENDARIO_PADRAO = "#3b82f6";

export interface CalendarioSelecionadoView {
  id: string;
  googleCalendarId: string;
  nome: string;
  corHex: string | null;
  timezone: string;
  papelAcesso: string;
  visivel: boolean;
  gravavel: boolean;
}

export interface ColegaAgendaView {
  colegaId: number;
  cor: string;
  visivel: boolean;
  colega: {
    id: number;
    nome: string;
    email: string;
  };
}

export interface EventoExibicao {
  id: string;
  googleEventId: string;
  status: string;
  titulo: string | null;
  inicioEm: string | null;
  fimEm: string | null;
  diaInteiro: boolean;
  etag: string;
  linkMeet: string | null;
  calendarioId: string;
  calendarioGoogleId: string;
  calendarioNome: string;
  calendarioCorHex: string | null;
  calendarioGravavel: boolean;
  /** Presente quando o evento pertence à agenda de um colega (não do próprio usuário logado). */
  colegaId?: number;
}
