"use client";
import { create } from "zustand";
import type { AlertaTarefaBpm } from "@/lib/bpm/notificacoes-tarefas";

type Notificacao = AlertaTarefaBpm & { lida: boolean };
type Estado = {
  usuarioId: number; notificacoes: Notificacao[]; vistas: Set<string>; removidas: Set<string>;
  iniciarUsuario: (id: number) => void;
  sincronizar: (id: number, alertas: AlertaTarefaBpm[]) => Notificacao[];
  removerNotificacao: (id: string) => void;
  marcarTodasLidas: () => void;
};

// Sem persistência de dados de clientes no navegador; estado isolado por sessão/usuário.
export const useBpmTarefasNotificacoes = create<Estado>((set, get) => ({
  usuarioId: 0, notificacoes: [], vistas: new Set(), removidas: new Set(),
  iniciarUsuario: (id) => {
    if (get().usuarioId !== id) set({ usuarioId: id, notificacoes: [], vistas: new Set(), removidas: new Set() });
  },
  sincronizar: (id, alertas) => {
    const atual = get();
    if (atual.usuarioId !== id) return [];
    const anteriores = new Map(atual.notificacoes.map((item) => [item.id, item]));
    const unicos = [...new Map(alertas.map((item) => [item.id, item])).values()];
    const notificacoes = unicos.filter((item) => !atual.removidas.has(item.id))
      .map((item) => ({ ...item, lida: anteriores.get(item.id)?.lida ?? atual.vistas.has(item.id) }));
    const novas = notificacoes.filter((item) => !atual.vistas.has(item.id));
    set({ notificacoes, vistas: new Set([...atual.vistas, ...unicos.map((item) => item.id)]) });
    return novas;
  },
  removerNotificacao: (id) => set((atual) => ({
    notificacoes: atual.notificacoes.filter((item) => item.id !== id), removidas: new Set([...atual.removidas, id]),
  })),
  marcarTodasLidas: () => set((atual) => ({ notificacoes: atual.notificacoes.map((item) => ({ ...item, lida: true })) })),
}));
