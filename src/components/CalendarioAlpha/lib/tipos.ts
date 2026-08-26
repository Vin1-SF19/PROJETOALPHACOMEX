/** Cor usada quando o Google não retorna `backgroundColor` para o calendário/evento. */
export const COR_CALENDARIO_PADRAO = "#3b82f6";

export function corDoItemAgenda(item: Pick<EventoExibicao, "tipo" | "eventType" | "calendarioCorHex">): string {
  if (item.tipo === "tarefa") return "#22c55e";
  if (item.eventType === "focusTime") return "#a855f7";
  if (item.eventType === "outOfOffice") return "#f43f5e";
  if (item.eventType === "workingLocation") return "#0ea5e9";
  return item.calendarioCorHex ?? COR_CALENDARIO_PADRAO;
}

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
  papel: "VISUALIZADOR" | "EDITOR";
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
  eventType: string;
  tipo: "evento" | "tarefa";
  tarefaCacheId?: string;
  calendarioId: string;
  calendarioGoogleId: string;
  calendarioNome: string;
  calendarioCorHex: string | null;
  calendarioGravavel: boolean;
  /** Presente quando o evento pertence à agenda de um colega (não do próprio usuário logado). */
  colegaId?: number;
}

export interface TarefaAgendaExibicao {
  id: string;
  taskListGoogleId: string;
  listaTitulo: string;
  titulo: string;
  status: "needsAction" | "completed";
  vencimentoEm: string | null;
}

export interface ListaTarefasAgendaView {
  googleTaskListId: string;
  titulo: string;
}
