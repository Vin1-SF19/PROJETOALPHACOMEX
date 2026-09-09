export const AGENDA_ALPHA_URL = "/PainelAlpha/CalendarioAlpha";
export const AGENDA_ALPHA_LABEL = "Agenda Alpha";
export const AGENDA_ALPHA_MENSAGEM = "ALPHA_CALENDARIO_ACTION";
export const AGENDA_ALPHA_PRONTA_MENSAGEM = "ALPHA_CALENDARIO_READY";
export const AGENDA_ALPHA_CONFIRMACAO_MENSAGEM = "ALPHA_CALENDARIO_ACTION_ACK";

export type IntencaoAgendaAlpha =
  | { acao: "ABRIR_AGENDA" }
  | { acao: "ABRIR_COMPARTILHAMENTOS"; solicitacaoId?: string };

export function intencaoParaNotificacaoAgenda(notificacao: {
  tipo: "COMPROMISSO" | "SOLICITACAO_RECEBIDA" | "SOLICITACAO_RESPONDIDA";
  solicitacaoId?: string;
}): IntencaoAgendaAlpha {
  return notificacao.tipo === "SOLICITACAO_RECEBIDA"
    ? { acao: "ABRIR_COMPARTILHAMENTOS", solicitacaoId: notificacao.solicitacaoId }
    : { acao: "ABRIR_AGENDA" };
}
