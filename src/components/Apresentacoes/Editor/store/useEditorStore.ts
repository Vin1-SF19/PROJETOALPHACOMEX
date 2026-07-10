import { create } from "zustand";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";

export interface SlideResumo {
  id: string;
  ordem: number;
  nome: string | null;
}

interface EditorStore {
  apresentacaoId: string | null;
  slides: SlideResumo[];
  slideAtivoId: string | null;
  componentes: ComponenteSlide[];
  componenteSelecionadoId: string | null;
  zoom: number;
  isDirty: boolean;
  isSaving: boolean;

  inicializar: (apresentacaoId: string, slides: SlideResumo[]) => void;
  setSlides: (slides: SlideResumo[]) => void;
  carregarSlide: (slideId: string, componentes: ComponenteSlide[]) => void;
  setSlideAtivo: (slideId: string) => void;
  adicionarComponente: (c: ComponenteSlide) => void;
  atualizarComponente: (id: string, patch: Partial<ComponenteSlide>) => void;
  removerComponente: (id: string) => void;
  selecionarComponente: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  marcarSujo: () => void;
  marcarSalvo: () => void;
  setSaving: (saving: boolean) => void;
}

function ehContainerComFilhos(c: ComponenteSlide): c is Extract<ComponenteSlide, { tipo: "card" | "grid" | "container" }> {
  return (c.tipo === "card" || c.tipo === "grid" || c.tipo === "container") && c.filhos.length > 0;
}

/** Busca recursiva (profundidade primeiro) por id dentro da árvore de componentes, incluindo filhos de containers. */
function atualizarNaArvore(lista: ComponenteSlide[], id: string, patch: Partial<ComponenteSlide>): ComponenteSlide[] {
  return lista.map((c) => {
    if (c.id === id) return { ...c, ...patch } as ComponenteSlide;
    if (ehContainerComFilhos(c)) {
      return { ...c, filhos: atualizarNaArvore(c.filhos, id, patch) };
    }
    return c;
  });
}

function removerDaArvore(lista: ComponenteSlide[], id: string): ComponenteSlide[] {
  return lista
    .filter((c) => c.id !== id)
    .map((c) => {
      if (ehContainerComFilhos(c)) {
        return { ...c, filhos: removerDaArvore(c.filhos, id) };
      }
      return c;
    });
}

export const useEditorStore = create<EditorStore>((set) => ({
  apresentacaoId: null,
  slides: [],
  slideAtivoId: null,
  componentes: [],
  componenteSelecionadoId: null,
  zoom: 1,
  isDirty: false,
  isSaving: false,

  inicializar: (apresentacaoId, slides) => set({ apresentacaoId, slides }),
  setSlides: (slides) => set({ slides }),
  carregarSlide: (slideId, componentes) =>
    set({ slideAtivoId: slideId, componentes, componenteSelecionadoId: null, isDirty: false }),
  setSlideAtivo: (slideId) => set({ slideAtivoId: slideId, componenteSelecionadoId: null }),

  adicionarComponente: (c) =>
    set((state) => ({ componentes: [...state.componentes, c], componenteSelecionadoId: c.id, isDirty: true })),

  atualizarComponente: (id, patch) =>
    set((state) => ({ componentes: atualizarNaArvore(state.componentes, id, patch), isDirty: true })),

  removerComponente: (id) =>
    set((state) => ({
      componentes: removerDaArvore(state.componentes, id),
      componenteSelecionadoId: state.componenteSelecionadoId === id ? null : state.componenteSelecionadoId,
      isDirty: true,
    })),

  selecionarComponente: (id) => set({ componenteSelecionadoId: id }),
  setZoom: (zoom) => set({ zoom: Math.min(4, Math.max(0.25, zoom)) }),
  marcarSujo: () => set({ isDirty: true }),
  marcarSalvo: () => set({ isDirty: false, isSaving: false }),
  setSaving: (saving) => set({ isSaving: saving }),
}));
