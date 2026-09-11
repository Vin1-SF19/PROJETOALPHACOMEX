import { create } from 'zustand';

export interface ChamadoNotificacao {
  id: string;
  chamadoId: number;
  titulo: string;
  usuario: string;
  setor: string;
  urgencia: string;
  createdAt: string;
  lida: boolean;
}

export interface ChamadoFeedbackPendente {
  chamadoId: number;
  titulo: string;
  closedAt: string;
}

interface ChamadoNotificacoesStore {
  notificacoes: ChamadoNotificacao[];
  feedbacksPendentes: ChamadoFeedbackPendente[];
  adicionarNotificacao: (
    n: Omit<ChamadoNotificacao, 'id' | 'lida'> & { id?: string },
  ) => void;
  marcarTodasLidas: () => void;
  removerNotificacao: (id: string) => void;
  adicionarFeedbackPendente: (feedback: ChamadoFeedbackPendente) => void;
  sincronizarFeedbacksPendentes: (feedbacks: ChamadoFeedbackPendente[]) => void;
  removerFeedbackPendente: (chamadoId: number) => void;
}

export const useChamadoNotificacoes = create<ChamadoNotificacoesStore>((set) => ({
  notificacoes: [],
  feedbacksPendentes: [],
  adicionarNotificacao: (n) =>
    set((state) => {
      const id = n.id ?? `${Date.now()}-${n.chamadoId}`;
      if (state.notificacoes.some((notificacao) => notificacao.id === id)) return state;
      return {
        notificacoes: [
          { ...n, id, lida: false },
          ...state.notificacoes,
        ].slice(0, 50),
      };
    }),
  marcarTodasLidas: () =>
    set((state) => ({
      notificacoes: state.notificacoes.map((n) => ({ ...n, lida: true })),
    })),
  removerNotificacao: (id) =>
    set((state) => ({
      notificacoes: state.notificacoes.filter((n) => n.id !== id),
    })),
  adicionarFeedbackPendente: (feedback) =>
    set((state) => {
      if (state.feedbacksPendentes.some((item) => item.chamadoId === feedback.chamadoId)) {
        return state;
      }
      return {
        feedbacksPendentes: [...state.feedbacksPendentes, feedback],
      };
    }),
  sincronizarFeedbacksPendentes: (feedbacks) =>
    set({
      feedbacksPendentes: feedbacks.filter(
        (feedback, indice, itens) =>
          itens.findIndex((item) => item.chamadoId === feedback.chamadoId) === indice,
      ),
    }),
  removerFeedbackPendente: (chamadoId) =>
    set((state) => ({
      feedbacksPendentes: state.feedbacksPendentes.filter(
        (feedback) => feedback.chamadoId !== chamadoId,
      ),
    })),
}));
