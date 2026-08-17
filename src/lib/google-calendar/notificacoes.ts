export const CALENDARIO_ALPHA_USUARIO_CHANNEL_PREFIX = "private-calendario-alpha-usuario-";

export const CALENDARIO_ALPHA_COMPROMISSO_EVENT = "calendario-alpha-compromisso";
export const CALENDARIO_ALPHA_SOLICITACAO_RECEBIDA_EVENT = "calendario-alpha-solicitacao-recebida";
export const CALENDARIO_ALPHA_SOLICITACAO_RESPONDIDA_EVENT = "calendario-alpha-solicitacao-respondida";

export interface CalendarioAlphaCompromissoPayload {
  id: string;
  googleEventId: string;
  titulo: string;
  inicioEm: string;
  janela: "10min" | "5min";
  calendarioNome: string;
  calendarioCorHex: string | null;
  createdAt: string;
}

export interface CalendarioAlphaSolicitacaoRecebidaPayload {
  solicitacaoId: string;
  solicitanteNome: string;
  papelPedido: "VISUALIZADOR" | "EDITOR";
  createdAt: string;
}

export interface CalendarioAlphaSolicitacaoRespondidaPayload {
  solicitacaoId: string;
  alvoNome: string;
  status: "ACEITO" | "RECUSADO";
  papelPedido: "VISUALIZADOR" | "EDITOR";
  createdAt: string;
}

export function canalCalendarioAlphaDoUsuario(userId: number): string {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error("ID de usuário inválido para o canal do Calendário Alpha.");
  }
  return `${CALENDARIO_ALPHA_USUARIO_CHANNEL_PREFIX}${userId}`;
}

export function extrairUsuarioIdDoCanalCalendarioAlpha(channelName: string): number | null {
  if (!channelName.startsWith(CALENDARIO_ALPHA_USUARIO_CHANNEL_PREFIX)) return null;

  const value = channelName.slice(CALENDARIO_ALPHA_USUARIO_CHANNEL_PREFIX.length);
  if (!/^[1-9]\d*$/.test(value)) return null;

  return Number(value);
}
