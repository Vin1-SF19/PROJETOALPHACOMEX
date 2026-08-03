import { create } from "zustand";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import { adaptarComponentesAoCanvas, CANVAS_PADRAO, type CanvasConfig } from "@/lib/apresentacoes/canvas";

export interface SlideResumo {
  id: string;
  ordem: number;
  nome: string | null;
  transicaoEntrada: string | null;
  componentes: ComponenteSlide[];
  canvas: CanvasConfig;
}

interface EditorStore {
  apresentacaoId: string | null;
  slides: SlideResumo[];
  slideAtivoId: string | null;
  componentes: ComponenteSlide[];
  canvas: CanvasConfig;
  componenteSelecionadoId: string | null;
  zoom: number;
  isDirty: boolean;
  isSaving: boolean;
  versaoEdicao: number;

  inicializar: (apresentacaoId: string, slides: SlideResumo[]) => void;
  setSlides: (slides: SlideResumo[]) => void;
  carregarSlide: (slideId: string, componentes: ComponenteSlide[], canvas?: CanvasConfig) => void;
  setSlideAtivo: (slideId: string) => void;
  adicionarComponente: (c: ComponenteSlide) => void;
  substituirComponentes: (componentes: ComponenteSlide[]) => void;
  atualizarComponente: (id: string, patch: Partial<ComponenteSlide>) => void;
  removerComponente: (id: string) => void;
  selecionarComponente: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  redimensionarCanvas: (canvas: CanvasConfig) => void;
  atualizarFundoCanvas: (backgroundColor: string) => void;
  marcarSujo: () => void;
  marcarSalvo: () => void;
  concluirSalvamento: (slideId: string, versao: number, sucesso: boolean) => void;
  setSaving: (saving: boolean) => void;
}

const filasPersistencia = new Map<string, Promise<void>>();

/** Serializa escritas do mesmo slide para uma resposta antiga nunca sobrescrever uma edição mais nova. */
export function serializarPersistenciaSlide<T>(slideId: string, operacao: () => Promise<T>): Promise<T> {
  const anterior = filasPersistencia.get(slideId) ?? Promise.resolve();
  const execucao = anterior.catch(() => undefined).then(operacao);
  const barreira = execucao.then(() => undefined, () => undefined);
  filasPersistencia.set(slideId, barreira);
  void barreira.then(() => {
    if (filasPersistencia.get(slideId) === barreira) filasPersistencia.delete(slideId);
  });
  return execucao;
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
  canvas: CANVAS_PADRAO,
  componenteSelecionadoId: null,
  zoom: 1,
  isDirty: false,
  isSaving: false,
  versaoEdicao: 0,

  inicializar: (apresentacaoId, slides) => set({ apresentacaoId, slides }),
  setSlides: (slides) =>
    set((state) => ({
      slides: slides.map((slide) =>
        slide.id === state.slideAtivoId ? { ...slide, componentes: state.componentes, canvas: state.canvas } : slide,
      ),
    })),
  carregarSlide: (slideId, componentes, canvas = CANVAS_PADRAO) =>
    set((state) => ({
      slides: state.slides.map((slide) =>
        slide.id === state.slideAtivoId ? { ...slide, componentes: state.componentes, canvas: state.canvas } : slide,
      ),
      slideAtivoId: slideId,
      componentes,
      canvas,
      componenteSelecionadoId: null,
      isDirty: false,
      versaoEdicao: state.versaoEdicao + 1,
    })),
  setSlideAtivo: (slideId) => set((state) => ({
    slideAtivoId: slideId,
    componenteSelecionadoId: null,
    versaoEdicao: state.versaoEdicao + 1,
  })),

  adicionarComponente: (c) =>
    set((state) => ({
      componentes: [...state.componentes, c],
      componenteSelecionadoId: c.id,
      isDirty: true,
      versaoEdicao: state.versaoEdicao + 1,
    })),

  substituirComponentes: (componentes) =>
    set((state) => ({
      componentes,
      componenteSelecionadoId: null,
      isDirty: true,
      versaoEdicao: state.versaoEdicao + 1,
    })),

  atualizarComponente: (id, patch) =>
    set((state) => ({
      componentes: atualizarNaArvore(state.componentes, id, patch),
      isDirty: true,
      versaoEdicao: state.versaoEdicao + 1,
    })),

  removerComponente: (id) =>
    set((state) => ({
      componentes: removerDaArvore(state.componentes, id),
      componenteSelecionadoId: state.componenteSelecionadoId === id ? null : state.componenteSelecionadoId,
      isDirty: true,
      versaoEdicao: state.versaoEdicao + 1,
    })),

  selecionarComponente: (id) => set({ componenteSelecionadoId: id }),
  setZoom: (zoom) => set({ zoom: Math.min(4, Math.max(0.25, zoom)) }),
  redimensionarCanvas: (canvas) =>
    set((state) => ({
      componentes: adaptarComponentesAoCanvas(state.componentes, state.canvas, canvas),
      canvas,
      componenteSelecionadoId: null,
      isDirty: true,
      versaoEdicao: state.versaoEdicao + 1,
    })),
  atualizarFundoCanvas: (backgroundColor) =>
    set((state) => ({
      canvas: { ...state.canvas, backgroundColor },
      isDirty: true,
      versaoEdicao: state.versaoEdicao + 1,
    })),
  marcarSujo: () => set((state) => ({ isDirty: true, versaoEdicao: state.versaoEdicao + 1 })),
  marcarSalvo: () => set({ isDirty: false, isSaving: false }),
  concluirSalvamento: (slideId, versao, sucesso) => set((state) => {
    const snapshotAindaAtual = state.slideAtivoId === slideId && state.versaoEdicao === versao;
    if (!snapshotAindaAtual) return { isSaving: state.isDirty };
    return { isDirty: sucesso ? false : state.isDirty, isSaving: false };
  }),
  setSaving: (saving) => set({ isSaving: saving }),
}));
