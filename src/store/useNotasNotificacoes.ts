import { create } from "zustand";
import type { NotaNotificacaoPayload } from "@/lib/notas/notificacoes";

export interface NotaNotificacao extends NotaNotificacaoPayload {
  id: string;
  lida: boolean;
}

interface NotasNotificacoesStore {
  notificacoes: NotaNotificacao[];
  adicionarNotificacao: (n: NotaNotificacaoPayload) => void;
  marcarTodasLidas: () => void;
  removerNotificacao: (id: string) => void;
}

export const useNotasNotificacoes = create<NotasNotificacoesStore>((set) => ({
  notificacoes: [],
  adicionarNotificacao: (n) =>
    set((state) => ({
      notificacoes: [
        { ...n, id: `${Date.now()}-${n.noteId}`, lida: false },
        ...state.notificacoes,
      ].slice(0, 50),
    })),
  marcarTodasLidas: () =>
    set((state) => ({
      notificacoes: state.notificacoes.map((n) => ({ ...n, lida: true })),
    })),
  removerNotificacao: (id) =>
    set((state) => ({
      notificacoes: state.notificacoes.filter((n) => n.id !== id),
    })),
}));
