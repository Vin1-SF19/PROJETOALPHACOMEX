/**
 * Escopos oficiais e granulares do Google Calendar API (privilégio mínimo).
 * Referência: https://developers.google.com/workspace/calendar/api/auth
 *
 * Nunca usar o escopo completo `https://www.googleapis.com/auth/calendar`
 * sem justificativa documentada e aprovada — ver story-calendario-alpha.md.
 */
export const ESCOPO_CALENDAR_LIST_READONLY =
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly";
export const ESCOPO_EVENTS_OWNED =
  "https://www.googleapis.com/auth/calendar.events.owned";
export const ESCOPO_EVENTS_READONLY =
  "https://www.googleapis.com/auth/calendar.events.readonly";
export const ESCOPO_FREEBUSY = "https://www.googleapis.com/auth/calendar.freebusy";

/**
 * Escopos usados pela Service Account (Domain-Wide Delegation) ao impersonar cada usuário.
 * Não há escopo de identidade (openid/userinfo.email) — a conta impersonada já é conhecida
 * de antemão via `usuarios.email` (mesmo e-mail do Google Workspace), sem etapa de descoberta.
 * Estes MESMOS escopos precisam estar autorizados no Admin Console do Workspace
 * (Security → API Controls → Domain-wide Delegation) para o Client ID da Service Account.
 */
export const ESCOPOS_CALENDARIO_ALPHA = [
  ESCOPO_CALENDAR_LIST_READONLY,
  ESCOPO_EVENTS_OWNED,
  ESCOPO_EVENTS_READONLY,
  ESCOPO_FREEBUSY,
] as const;
