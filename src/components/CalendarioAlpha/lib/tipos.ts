/** Cor usada quando o Google não retorna `backgroundColor` para o calendário/evento. */
export const COR_CALENDARIO_PADRAO = "#3b82f6";

function hashEstavel(valor: string): number {
  let resultado = 0;
  for (let indice = 0; indice < valor.length; indice += 1) {
    resultado = ((resultado << 5) - resultado + valor.charCodeAt(indice)) | 0;
  }
  return Math.abs(resultado);
}

function hexParaHsl(hex: string): { h: number; s: number; l: number } | null {
  const valor = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(valor)) return null;
  const [r, g, b] = [0, 2, 4].map((inicio) => Number.parseInt(valor.slice(inicio, inicio + 2), 16) / 255);
  const maximo = Math.max(r, g, b);
  const minimo = Math.min(r, g, b);
  const delta = maximo - minimo;
  const l = (maximo + minimo) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (delta !== 0) {
    if (maximo === r) h = 60 * (((g - b) / delta) % 6);
    else if (maximo === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  return { h: (h + 360) % 360, s, l };
}

function hslParaHex({ h, s, l }: { h: number; s: number; l: number }): string {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const segundo = chroma * (1 - Math.abs((h / 60) % 2 - 1));
  const ajuste = l - chroma / 2;
  const [r, g, b] = h < 60 ? [chroma, segundo, 0] : h < 120 ? [segundo, chroma, 0] : h < 180 ? [0, chroma, segundo] : h < 240 ? [0, segundo, chroma] : h < 300 ? [segundo, 0, chroma] : [chroma, 0, segundo];
  return `#${[r, g, b].map((canal) => Math.round((canal + ajuste) * 255).toString(16).padStart(2, "0")).join("")}`;
}

/** Varia a luminosidade da cor do calendário por item, sem perder a identidade escolhida pelo usuário. */
export function corDoItemAgenda(item: Pick<EventoExibicao, "id" | "tipo" | "eventType" | "calendarioCorHex">): string {
  const base = item.tipo === "tarefa" ? item.calendarioCorHex ?? "#22c55e"
    : item.eventType === "focusTime" ? "#a855f7"
      : item.eventType === "outOfOffice" ? "#f43f5e"
        : item.eventType === "workingLocation" ? "#0ea5e9"
          : item.calendarioCorHex ?? COR_CALENDARIO_PADRAO;
  const hsl = hexParaHsl(base);
  if (!hsl) return COR_CALENDARIO_PADRAO;
  const variacoes = [-0.1, -0.035, 0.045, 0.11, 0.17];
  const ajuste = variacoes[hashEstavel(item.id) % variacoes.length] ?? 0;
  return hslParaHex({ ...hsl, l: Math.max(0.28, Math.min(0.7, hsl.l + ajuste)) });
}

/** A resposta `declined` do participante atual é persistida no cache durante o sync. */
export function eventoFoiRecusadoPeloUsuario(statusPropertiesJson: string | null): boolean {
  if (!statusPropertiesJson) return false;
  try {
    const propriedades = JSON.parse(statusPropertiesJson) as { respostaDoUsuario?: unknown };
    return propriedades.respostaDoUsuario === "declined";
  } catch {
    return false;
  }
}

/** Evento organizado por outra pessoa e colocado na agenda do usuário atual. */
export function eventoFoiCompartilhadoComUsuario(statusPropertiesJson: string | null): boolean {
  if (!statusPropertiesJson) return false;
  try {
    const propriedades = JSON.parse(statusPropertiesJson) as { compartilhadoComUsuario?: unknown };
    return propriedades.compartilhadoComUsuario === true;
  } catch {
    return false;
  }
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
  tarefaNotas?: string | null;
  calendarioId: string;
  calendarioGoogleId: string;
  calendarioNome: string;
  calendarioCorHex: string | null;
  calendarioGravavel: boolean;
  recusadoPeloUsuario?: boolean;
  compartilhadoComUsuario?: boolean;
  /** Presente quando o evento pertence à agenda de um colega (não do próprio usuário logado). */
  colegaId?: number;
}

export interface TarefaAgendaExibicao {
  id: string;
  taskListGoogleId: string;
  listaTitulo: string;
  titulo: string;
  notas: string | null;
  status: "needsAction" | "completed";
  vencimentoEm: string | null;
  inicioAgendadoEm?: string | null;
  fimPlanejadoAgendadoEm?: string | null;
  fimConcluidoAgendadoEm?: string | null;
  statusAgendamento?: "EM_ATENDIMENTO" | "CONCLUIDO" | null;
  /** Horário definido manualmente pelo usuário na Agenda Alpha (Google Tasks não guarda hora). */
  inicioLocalEm?: string | null;
  fimLocalEm?: string | null;
}

export interface ListaTarefasAgendaView {
  googleTaskListId: string;
  titulo: string;
}
