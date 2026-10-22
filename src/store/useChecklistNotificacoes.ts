import { create } from "zustand";
import { marcarEventoChecklistLido, listarEventosChecklist } from "@/actions/checklist/eventos";
import { confirmar } from "@/lib/checklist/client/types";
import type { ChecklistEvento } from "@/lib/checklist/client/notificacoes";
export interface ChecklistNotificacao {
  id: string;
  empresaId: string;
  titulo: string;
  criadoEm: string;
  lida: boolean;
  revision: number;
}
interface Store {
  usuarioId: number;
  notificacoes: ChecklistNotificacao[];
  ultimoEventoId: string | null;
  vistos: Set<string>;
  erro: string;
  iniciar: (id: number) => void;
  receber: (id: number, eventos: ChecklistEvento[]) => void;
  marcarLida: (id: string) => Promise<boolean>;
  marcarTodasLidas: () => Promise<void>;
  removerNotificacao: (id: string) => void;
}
export const useChecklistNotificacoes = create<Store>((set, get) => ({
  usuarioId: 0,
  notificacoes: [],
  ultimoEventoId: null,
  vistos: new Set(),
  erro: "",
  iniciar: (id) => {
    if (get().usuarioId !== id) set({ usuarioId: id, notificacoes: [], ultimoEventoId: null, vistos: new Set(), erro: "" });
  },
  receber: (id, eventos) => {
    if (get().usuarioId !== id) return;
    set((state) => {
      const map = new Map(state.notificacoes.map((n) => [n.id, n])),
        vistos = new Set(state.vistos);
      let ultimo = state.ultimoEventoId;
      for (const e of [...eventos].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.eventId.localeCompare(b.eventId))) {
        if (!e.empresaId) continue;
        const prior = map.get(e.eventId),
          fresh = !vistos.has(e.eventId);
        map.set(e.eventId, {
          id: e.eventId,
          empresaId: e.empresaId,
          titulo: e.tipo.replace(/_/g, " "),
          criadoEm: e.createdAt,
          lida: !!e.lidoEm || !!prior?.lida,
          revision: e.revision,
        });
        vistos.add(e.eventId);
        if (fresh && !e.lidoEm) ultimo = e.eventId;
      }
      return {
        notificacoes: [...map.values()].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm) || b.id.localeCompare(a.id)).slice(0, 50),
        vistos,
        ultimoEventoId: ultimo,
      };
    });
  },
  marcarLida: async (id) => {
    const actor = get().usuarioId;
    try {
      await confirmar(marcarEventoChecklistLido(id));
      if (get().usuarioId === actor) set((s) => ({ notificacoes: s.notificacoes.map((n) => (n.id === id ? { ...n, lida: true } : n)), erro: "" }));
      return true;
    } catch {
      if (get().usuarioId === actor) set({ erro: "Não foi possível confirmar a leitura. Tente novamente." });
      return false;
    }
  },
  marcarTodasLidas: async () => {
    const actor = get().usuarioId;
    try {
      let cursor: { createdAt: string; id: string } | undefined;
      do {
        const data = await confirmar(listarEventosChecklist({ cursor, limit: 100, somenteNaoLidos: true }));
        for (const e of data.items) {
          if (get().usuarioId !== actor) return;
          await confirmar(marcarEventoChecklistLido(e.eventId));
        }
        cursor = data.nextCursor ?? undefined;
      } while (cursor);
      if (get().usuarioId === actor) set((s) => ({ notificacoes: s.notificacoes.map((n) => ({ ...n, lida: true })), erro: "" }));
    } catch {
      if (get().usuarioId === actor) set({ erro: "Algumas leituras não foram confirmadas. Tente novamente." });
    }
  },
  removerNotificacao: (id) => {
    void get().marcarLida(id);
  },
}));
