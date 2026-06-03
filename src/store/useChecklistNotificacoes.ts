import { create } from 'zustand';

export interface ChecklistNotificacao {
  id: string;
  documentoId: string;
  itemDescricao: string;
  empresaId: string;
  razaoSocial: string;
  nomeCliente: string;
  nomeArquivo: string;
  criadoEm: string;
  lida: boolean;
}

interface ChecklistNotificacoesStore {
  notificacoes: ChecklistNotificacao[];
  adicionarNotificacao: (n: Omit<ChecklistNotificacao, 'id' | 'lida'>) => void;
  marcarTodasLidas: () => void;
  removerNotificacao: (id: string) => void;
}

export const useChecklistNotificacoes = create<ChecklistNotificacoesStore>((set) => ({
  notificacoes: [],
  adicionarNotificacao: (n) =>
    set((state) => ({
      notificacoes: [
        { ...n, id: `${Date.now()}-${n.documentoId}`, lida: false },
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
