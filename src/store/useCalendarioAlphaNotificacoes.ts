import { create } from "zustand";

import type {
  CalendarioAlphaCompromissoPayload,
  CalendarioAlphaSolicitacaoRecebidaPayload,
  CalendarioAlphaSolicitacaoRespondidaPayload,
} from "@/lib/google-calendar/notificacoes";

export type CalendarioAlphaNotificacao = { notificacaoId: string; lida: boolean } & (
  | ({ tipo: "COMPROMISSO" } & CalendarioAlphaCompromissoPayload)
  | ({ tipo: "SOLICITACAO_RECEBIDA" } & CalendarioAlphaSolicitacaoRecebidaPayload)
  | ({ tipo: "SOLICITACAO_RESPONDIDA" } & CalendarioAlphaSolicitacaoRespondidaPayload)
);

interface CalendarioAlphaNotificacoesStore {
  notificacoes: CalendarioAlphaNotificacao[];
  adicionarCompromisso: (payload: CalendarioAlphaCompromissoPayload) => void;
  adicionarSolicitacaoRecebida: (payload: CalendarioAlphaSolicitacaoRecebidaPayload) => void;
  adicionarSolicitacaoRespondida: (payload: CalendarioAlphaSolicitacaoRespondidaPayload) => void;
  marcarTodasLidas: () => void;
  removerNotificacao: (notificacaoId: string) => void;
}

function empurrar(
  set: (fn: (state: CalendarioAlphaNotificacoesStore) => Partial<CalendarioAlphaNotificacoesStore>) => void,
  notificacao: CalendarioAlphaNotificacao,
) {
  set((state) => ({
    notificacoes: [notificacao, ...state.notificacoes].slice(0, 50),
  }));
}

export const useCalendarioAlphaNotificacoes = create<CalendarioAlphaNotificacoesStore>((set) => ({
  notificacoes: [],
  adicionarCompromisso: (payload) =>
    empurrar(set, {
      ...payload,
      tipo: "COMPROMISSO",
      notificacaoId: `compromisso-${payload.googleEventId}-${payload.janela}`,
      lida: false,
    }),
  adicionarSolicitacaoRecebida: (payload) =>
    empurrar(set, {
      ...payload,
      tipo: "SOLICITACAO_RECEBIDA",
      notificacaoId: `solicitacao-recebida-${payload.solicitacaoId}`,
      lida: false,
    }),
  adicionarSolicitacaoRespondida: (payload) =>
    empurrar(set, {
      ...payload,
      tipo: "SOLICITACAO_RESPONDIDA",
      notificacaoId: `solicitacao-respondida-${payload.solicitacaoId}-${payload.status}`,
      lida: false,
    }),
  marcarTodasLidas: () =>
    set((state) => ({
      notificacoes: state.notificacoes.map((n) => ({ ...n, lida: true })),
    })),
  removerNotificacao: (notificacaoId) =>
    set((state) => ({
      notificacoes: state.notificacoes.filter((n) => n.notificacaoId !== notificacaoId),
    })),
}));
