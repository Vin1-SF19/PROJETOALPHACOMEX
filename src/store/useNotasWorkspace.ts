import { create } from "zustand";
import type { ViewerMode } from "@/lib/validations/notas";
import type { NotaTab } from "@/lib/notas-tabs";

export type EstadoSincronizacaoNota = "salvo" | "pendente" | "salvando" | "erro" | "conflito" | "offline";

interface NotasWorkspaceStore {
  tabs: NotaTab[];
  activeTabId: string | null;
  isTaskbarVisible: boolean;
  viewerMode: ViewerMode;
  viewerHeight: number;
  hydrated: boolean;

  /** Estado de sincronização por noteId — nunca guarda o conteúdo integral da nota aqui. */
  syncState: Record<string, EstadoSincronizacaoNota>;

  hidratar: (state: { tabs: NotaTab[]; activeId: string | null }) => void;
  abrirAba: (noteId: string, title: string, opts?: { pinned?: boolean; color?: string | null }) => void;
  fecharAba: (tabId: string) => void;
  ativarAba: (tabId: string) => void;
  reordenarAbas: (draggedId: string, targetId: string) => void;
  renomearAba: (tabId: string, title: string) => void;
  definirCorAba: (tabId: string, color: string | null) => void;
  definirPinnedAba: (noteId: string, pinned: boolean) => void;
  setViewerMode: (mode: ViewerMode) => void;
  setViewerHeight: (height: number) => void;
  toggleTaskbar: () => void;
  setSyncState: (noteId: string, estado: EstadoSincronizacaoNota) => void;
}

export const useNotasWorkspace = create<NotasWorkspaceStore>((set) => ({
  tabs: [],
  activeTabId: null,
  isTaskbarVisible: true,
  viewerMode: "RECOLHIDO",
  viewerHeight: 320,
  hydrated: false,
  syncState: {},

  hidratar: ({ tabs, activeId }) => set({ tabs, activeTabId: activeId, hydrated: true }),

  abrirAba: (noteId, title, opts) =>
    set((state) => {
      const existente = state.tabs.find((tab) => tab.noteId === noteId);
      if (existente) {
        return { activeTabId: existente.id, viewerMode: state.viewerMode === "RECOLHIDO" ? "COMPACTO" : state.viewerMode };
      }
      const id = `nota-tab-${noteId}`;
      return {
        tabs: [...state.tabs, { id, noteId, title, pinned: opts?.pinned, color: opts?.color }],
        activeTabId: id,
        viewerMode: state.viewerMode === "RECOLHIDO" ? "COMPACTO" : state.viewerMode,
      };
    }),

  fecharAba: (tabId) =>
    set((state) => {
      const idx = state.tabs.findIndex((tab) => tab.id === tabId);
      if (idx === -1) return state;
      // Abas fixadas não fecham pelo fluxo normal — precisam ser desafixadas primeiro (mesma
      // regra da aba fixa "IAlpha" na barra principal do painel).
      if (state.tabs[idx].pinned) return state;
      const restantes = state.tabs.filter((tab) => tab.id !== tabId);
      const activeTabId =
        state.activeTabId === tabId
          ? (restantes[Math.max(0, idx - 1)]?.id ?? null)
          : state.activeTabId;
      return { tabs: restantes, activeTabId };
    }),

  ativarAba: (tabId) => set({ activeTabId: tabId, viewerMode: "COMPACTO" }),

  reordenarAbas: (draggedId, targetId) =>
    set((state) => {
      const oldIndex = state.tabs.findIndex((tab) => tab.id === draggedId);
      const newIndex = state.tabs.findIndex((tab) => tab.id === targetId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return state;

      const novasTabs = [...state.tabs];
      const [removida] = novasTabs.splice(oldIndex, 1);
      novasTabs.splice(newIndex, 0, removida);
      return { tabs: novasTabs };
    }),

  renomearAba: (tabId, title) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, title } : tab)),
    })),

  definirCorAba: (tabId, color) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.id === tabId ? { ...tab, color } : tab)),
    })),

  definirPinnedAba: (noteId, pinned) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.noteId === noteId ? { ...tab, pinned } : tab)),
    })),

  setViewerMode: (viewerMode) => set({ viewerMode }),
  setViewerHeight: (viewerHeight) => set({ viewerHeight }),
  toggleTaskbar: () => set((state) => ({ isTaskbarVisible: !state.isTaskbarVisible })),
  setSyncState: (noteId, estado) =>
    set((state) => ({ syncState: { ...state.syncState, [noteId]: estado } })),
}));
