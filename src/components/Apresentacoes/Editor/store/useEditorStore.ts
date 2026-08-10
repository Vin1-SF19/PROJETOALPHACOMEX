import { create } from "zustand";
import type { ComponenteSlide, FundoAnimadoComponente } from "@/lib/validations/slide-componentes";
import { adaptarComponentesAoCanvas, CANVAS_PADRAO, type CanvasConfig } from "@/lib/apresentacoes/canvas";
import type { AnimationGroup, ElementAnimation, SlideAnimationConfig } from "@/lib/apresentacoes/animacao/tipos";
import type { GuiasAlinhamento } from "@/lib/apresentacoes/alinhamento";

export type EixoCentralizacao = "horizontal" | "vertical" | "ambos";

export interface SlideResumo {
  id: string;
  ordem: number;
  nome: string | null;
  transicaoEntrada: string | null;
  componentes: ComponenteSlide[];
  canvas: CanvasConfig;
  animacaoConfig?: SlideAnimationConfig;
}

export interface EstadoEditavelSlide {
  componentes: ComponenteSlide[];
  canvas: CanvasConfig;
  animacaoConfig: SlideAnimationConfig | undefined;
  transicaoEntrada: string | null;
}

interface PosicaoComponente {
  id: string;
  x: number;
  y: number;
}

interface EditorStore {
  apresentacaoId: string | null;
  slides: SlideResumo[];
  slideAtivoId: string | null;
  componentes: ComponenteSlide[];
  canvas: CanvasConfig;
  animacaoConfig: SlideAnimationConfig | undefined;
  transicaoEntrada: string | null;
  componenteSelecionadoId: string | null;
  componentesSelecionadosIds: string[];
  historicoPassado: EstadoEditavelSlide[];
  historicoFuturo: EstadoEditavelSlide[];
  zoom: number;
  isDirty: boolean;
  isSaving: boolean;
  versaoEdicao: number;
  guiasAlinhamento: GuiasAlinhamento;

  inicializar: (apresentacaoId: string, slides: SlideResumo[]) => void;
  setSlides: (slides: SlideResumo[]) => void;
  carregarSlide: (slideId: string, componentes: ComponenteSlide[], canvas?: CanvasConfig, animacaoConfig?: SlideAnimationConfig, transicaoEntrada?: string | null) => void;
  setSlideAtivo: (slideId: string) => void;
  adicionarComponente: (c: ComponenteSlide) => void;
  aplicarFundo: (fundo: FundoAnimadoComponente) => void;
  substituirComponentes: (componentes: ComponenteSlide[]) => void;
  atualizarComponente: (id: string, patch: Partial<ComponenteSlide>) => void;
  atualizarComponentes: (patches: Record<string, Partial<ComponenteSlide>>) => void;
  moverComponentes: (origens: PosicaoComponente[], deltaX: number, deltaY: number) => void;
  removerComponente: (id: string) => void;
  removerComponentes: (ids: string[]) => void;
  selecionarComponente: (id: string | null, aditivo?: boolean) => void;
  reordenarCamadas: (ordemDoTopoParaBase: string[]) => void;
  centralizarSelecionados: (eixo?: EixoCentralizacao) => void;
  iniciarTransacaoHistorico: () => void;
  finalizarTransacaoHistorico: () => void;
  desfazer: () => void;
  refazer: () => void;
  setZoom: (zoom: number) => void;
  setGuiasAlinhamento: (guias: GuiasAlinhamento) => void;
  redimensionarCanvas: (canvas: CanvasConfig) => void;
  atualizarFundoCanvas: (backgroundColor: string) => void;
  atualizarTransicaoSlide: (transicaoEntrada: string | null) => void;
  adicionarAnimacaoElemento: (animacao: ElementAnimation) => void;
  adicionarAnimacoesElementos: (animacoes: ElementAnimation[]) => void;
  removerAnimacaoElemento: (animacaoId: string) => void;
  atualizarAnimacaoElemento: (id: string, patch: Partial<ElementAnimation>) => void;
  reordenarAnimacoesElemento: (elementId: string, novaOrdemIds: string[]) => void;
  agruparAnimacoes: (animacaoIds: string[], nomeGrupo?: string) => void;
  desagruparAnimacoes: (grupoId: string) => void;
  marcarSujo: () => void;
  marcarSalvo: () => void;
  concluirSalvamento: (slideId: string, versao: number, sucesso: boolean) => void;
  setSaving: (saving: boolean) => void;
}

const LIMITE_HISTORICO = 100;
const filasPersistencia = new Map<string, Promise<void>>();
let profundidadeTransacaoHistorico = 0;
let snapshotTransacaoHistorico: EstadoEditavelSlide | null = null;

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

function clonar<T>(valor: T): T {
  return structuredClone(valor);
}

function capturarEstadoEditavel(state: Pick<EditorStore, "componentes" | "canvas" | "animacaoConfig" | "transicaoEntrada">): EstadoEditavelSlide {
  return clonar({
    componentes: state.componentes,
    canvas: state.canvas,
    animacaoConfig: state.animacaoConfig,
    transicaoEntrada: state.transicaoEntrada,
  });
}

function estadosIguais(a: EstadoEditavelSlide, b: EstadoEditavelSlide): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function registrarHistorico(state: EditorStore): Pick<EditorStore, "historicoPassado" | "historicoFuturo"> | Record<string, never> {
  if (profundidadeTransacaoHistorico > 0) return {};
  return {
    historicoPassado: [...state.historicoPassado, capturarEstadoEditavel(state)].slice(-LIMITE_HISTORICO),
    historicoFuturo: [],
  };
}

function ehContainerComFilhos(c: ComponenteSlide): c is Extract<ComponenteSlide, { tipo: "card" | "grid" | "container" }> {
  return (c.tipo === "card" || c.tipo === "grid" || c.tipo === "container") && c.filhos.length > 0;
}

function atualizarNaArvore(lista: ComponenteSlide[], id: string, patch: Partial<ComponenteSlide>): ComponenteSlide[] {
  return lista.map((c) => {
    if (c.id === id) return { ...c, ...patch } as ComponenteSlide;
    if (ehContainerComFilhos(c)) return { ...c, filhos: atualizarNaArvore(c.filhos, id, patch) };
    return c;
  });
}

function atualizarMultiplosNaArvore(lista: ComponenteSlide[], patches: Record<string, Partial<ComponenteSlide>>): ComponenteSlide[] {
  return lista.map((c) => {
    const patch = patches[c.id];
    const componenteAtualizado = patch ? ({ ...c, ...patch } as ComponenteSlide) : c;
    if (ehContainerComFilhos(componenteAtualizado)) {
      return { ...componenteAtualizado, filhos: atualizarMultiplosNaArvore(componenteAtualizado.filhos, patches) };
    }
    return componenteAtualizado;
  });
}

function coletarIdsSubarvore(lista: ComponenteSlide[], idsRaiz: Set<string>, saida = new Set<string>()): Set<string> {
  for (const componente of lista) {
    if (idsRaiz.has(componente.id)) {
      const visitar = (item: ComponenteSlide) => {
        saida.add(item.id);
        if (ehContainerComFilhos(item)) item.filhos.forEach(visitar);
      };
      visitar(componente);
    } else if (ehContainerComFilhos(componente)) {
      coletarIdsSubarvore(componente.filhos, idsRaiz, saida);
    }
  }
  return saida;
}

function removerDaArvore(lista: ComponenteSlide[], ids: Set<string>): ComponenteSlide[] {
  return lista
    .filter((c) => !ids.has(c.id))
    .map((c) => (ehContainerComFilhos(c) ? { ...c, filhos: removerDaArvore(c.filhos, ids) } : c));
}

function limparAnimacoesDeElementos(config: SlideAnimationConfig | undefined, ids: Set<string>): SlideAnimationConfig | undefined {
  if (!config?.timeline) return config;
  const animations = config.timeline.animations.filter((animacao) => !ids.has(animacao.elementId));
  const idsAnimacoes = new Set(animations.map((animacao) => animacao.id));
  const groups = config.timeline.groups
    ?.map((grupo) => ({ ...grupo, animationIds: grupo.animationIds.filter((id) => idsAnimacoes.has(id)) }))
    .filter((grupo) => grupo.animationIds.length > 0);
  return { ...config, timeline: { ...config.timeline, animations, groups } };
}

function selecaoValida(state: EditorStore, componentes: ComponenteSlide[]) {
  const existentes = coletarIdsSubarvore(componentes, new Set(state.componentesSelecionadosIds));
  const selecionados = state.componentesSelecionadosIds.filter((id) => existentes.has(id));
  return {
    componentesSelecionadosIds: selecionados,
    componenteSelecionadoId: selecionados.includes(state.componenteSelecionadoId ?? "")
      ? state.componenteSelecionadoId
      : selecionados.at(-1) ?? null,
  };
}

function estadoAlterado(state: EditorStore) {
  return { isDirty: true, versaoEdicao: state.versaoEdicao + 1 };
}

function ajustarFundosAoCanvas(componentes: ComponenteSlide[], canvas: CanvasConfig): ComponenteSlide[] {
  const elementos = componentes.filter((componente) => componente.tipo !== "fundoAnimado");
  const zBase = elementos.length > 0 ? Math.min(...elementos.map((componente) => componente.zIndex)) - 1 : 0;
  let indiceFundo = 0;
  return componentes.map((componente) => {
    if (componente.tipo !== "fundoAnimado") return componente;
    const zIndex = zBase - indiceFundo;
    indiceFundo += 1;
    return { ...componente, x: 0, y: 0, w: canvas.width, h: canvas.height, zIndex, rotacao: 0 };
  });
}

export const useEditorStore = create<EditorStore>((set) => ({
  apresentacaoId: null,
  slides: [],
  slideAtivoId: null,
  componentes: [],
  canvas: CANVAS_PADRAO,
  animacaoConfig: undefined,
  transicaoEntrada: null,
  componenteSelecionadoId: null,
  componentesSelecionadosIds: [],
  historicoPassado: [],
  historicoFuturo: [],
  zoom: 1,
  isDirty: false,
  isSaving: false,
  versaoEdicao: 0,
  guiasAlinhamento: { verticais: [], horizontais: [] },

  inicializar: (apresentacaoId, slides) => set({ apresentacaoId, slides }),
  setSlides: (slides) =>
    set((state) => ({
      slides: slides.map((slide) =>
        slide.id === state.slideAtivoId
          ? { ...slide, componentes: state.componentes, canvas: state.canvas, animacaoConfig: state.animacaoConfig, transicaoEntrada: state.transicaoEntrada }
          : slide,
      ),
    })),
  carregarSlide: (slideId, componentes, canvas = CANVAS_PADRAO, animacaoConfig, transicaoEntrada = null) => {
    profundidadeTransacaoHistorico = 0;
    snapshotTransacaoHistorico = null;
    set((state) => ({
      slides: state.slides.map((slide) =>
        slide.id === state.slideAtivoId
          ? { ...slide, componentes: state.componentes, canvas: state.canvas, animacaoConfig: state.animacaoConfig, transicaoEntrada: state.transicaoEntrada }
          : slide,
      ),
      slideAtivoId: slideId,
      componentes: ajustarFundosAoCanvas(componentes, canvas),
      canvas,
      animacaoConfig,
      transicaoEntrada,
      componenteSelecionadoId: null,
      componentesSelecionadosIds: [],
      historicoPassado: [],
      historicoFuturo: [],
      guiasAlinhamento: { verticais: [], horizontais: [] },
      isDirty: false,
      versaoEdicao: state.versaoEdicao + 1,
    }));
  },
  setSlideAtivo: (slideId) => {
    profundidadeTransacaoHistorico = 0;
    snapshotTransacaoHistorico = null;
    set((state) => ({
      slideAtivoId: slideId,
      componenteSelecionadoId: null,
      componentesSelecionadosIds: [],
      historicoPassado: [],
      historicoFuturo: [],
      guiasAlinhamento: { verticais: [], horizontais: [] },
      versaoEdicao: state.versaoEdicao + 1,
    }));
  },

  adicionarComponente: (c) => set((state) => ({
    ...registrarHistorico(state),
    componentes: [...state.componentes, c],
    componenteSelecionadoId: c.id,
    componentesSelecionadosIds: [c.id],
    ...estadoAlterado(state),
  })),
  aplicarFundo: (fundo) => set((state) => {
    const semFundo = state.componentes.filter((componente) => componente.tipo !== "fundoAnimado");
    const menorZIndex = semFundo.length > 0 ? Math.min(...semFundo.map((componente) => componente.zIndex)) - 1 : 0;
    const fundoAjustado: FundoAnimadoComponente = {
      ...fundo,
      x: 0,
      y: 0,
      w: state.canvas.width,
      h: state.canvas.height,
      zIndex: menorZIndex,
      rotacao: 0,
    };
    return {
      ...registrarHistorico(state),
      componentes: [fundoAjustado, ...semFundo],
      componenteSelecionadoId: null,
      componentesSelecionadosIds: [],
      ...estadoAlterado(state),
    };
  }),
  substituirComponentes: (componentes) => set((state) => ({
    ...registrarHistorico(state),
    componentes: ajustarFundosAoCanvas(componentes, state.canvas),
    componenteSelecionadoId: null,
    componentesSelecionadosIds: [],
    ...estadoAlterado(state),
  })),
  atualizarComponente: (id, patch) => set((state) => ({
    ...registrarHistorico(state),
    componentes: atualizarNaArvore(state.componentes, id, patch),
    ...estadoAlterado(state),
  })),
  atualizarComponentes: (patches) => set((state) => ({
    ...registrarHistorico(state),
    componentes: atualizarMultiplosNaArvore(state.componentes, patches),
    ...estadoAlterado(state),
  })),
  moverComponentes: (origens, deltaX, deltaY) => set((state) => {
    const patches = Object.fromEntries(origens.map((origem) => [origem.id, { x: origem.x + deltaX, y: origem.y + deltaY }]));
    return {
      ...registrarHistorico(state),
      componentes: atualizarMultiplosNaArvore(state.componentes, patches),
      ...estadoAlterado(state),
    };
  }),
  removerComponente: (id) => set((state) => {
    const ids = coletarIdsSubarvore(state.componentes, new Set([id]));
    const componentes = removerDaArvore(state.componentes, ids);
    const restantes = state.componentesSelecionadosIds.filter((selecionado) => !ids.has(selecionado));
    return {
      ...registrarHistorico(state),
      componentes,
      animacaoConfig: limparAnimacoesDeElementos(state.animacaoConfig, ids),
      componentesSelecionadosIds: restantes,
      componenteSelecionadoId: restantes.at(-1) ?? null,
      ...estadoAlterado(state),
    };
  }),
  removerComponentes: (idsEntrada) => set((state) => {
    if (idsEntrada.length === 0) return state;
    const ids = coletarIdsSubarvore(state.componentes, new Set(idsEntrada));
    return {
      ...registrarHistorico(state),
      componentes: removerDaArvore(state.componentes, ids),
      animacaoConfig: limparAnimacoesDeElementos(state.animacaoConfig, ids),
      componentesSelecionadosIds: [],
      componenteSelecionadoId: null,
      ...estadoAlterado(state),
    };
  }),
  selecionarComponente: (id, aditivo = false) => set((state) => {
    if (!id) return { componenteSelecionadoId: null, componentesSelecionadosIds: [] };
    if (!aditivo) return { componenteSelecionadoId: id, componentesSelecionadosIds: [id] };
    const jaSelecionado = state.componentesSelecionadosIds.includes(id);
    const selecionados = jaSelecionado
      ? state.componentesSelecionadosIds.filter((item) => item !== id)
      : [...state.componentesSelecionadosIds, id];
    return {
      componentesSelecionadosIds: selecionados,
      componenteSelecionadoId: jaSelecionado ? selecionados.at(-1) ?? null : id,
    };
  }),
  reordenarCamadas: (ordemDoTopoParaBase) => set((state) => {
    if (ordemDoTopoParaBase.length !== state.componentes.length) return state;
    const idsFundos = new Set(state.componentes.filter((componente) => componente.tipo === "fundoAnimado").map((componente) => componente.id));
    const ordemElementos = ordemDoTopoParaBase.filter((id) => !idsFundos.has(id));
    const ordemFundos = ordemDoTopoParaBase.filter((id) => idsFundos.has(id));
    const zIndexPorId = new Map<string, number>();
    ordemElementos.forEach((id, index) => zIndexPorId.set(id, ordemElementos.length - index + 1));
    ordemFundos.forEach((id, index) => zIndexPorId.set(id, -index));
    return {
      ...registrarHistorico(state),
      componentes: state.componentes.map((componente) => ({ ...componente, zIndex: zIndexPorId.get(componente.id) ?? componente.zIndex })),
      ...estadoAlterado(state),
    };
  }),
  centralizarSelecionados: (eixo = "ambos") => set((state) => {
    const selecionados = state.componentes.filter(
      (componente) => componente.tipo !== "fundoAnimado" && state.componentesSelecionadosIds.includes(componente.id),
    );
    if (selecionados.length === 0) return state;
    const esquerda = Math.min(...selecionados.map((componente) => componente.x));
    const topo = Math.min(...selecionados.map((componente) => componente.y));
    const direita = Math.max(...selecionados.map((componente) => componente.x + componente.w));
    const base = Math.max(...selecionados.map((componente) => componente.y + componente.h));
    const deltaX = (state.canvas.width - (direita - esquerda)) / 2 - esquerda;
    const deltaY = (state.canvas.height - (base - topo)) / 2 - topo;
    const patches = Object.fromEntries(selecionados.map((componente) => [
      componente.id,
      {
        x: componente.x + (eixo === "vertical" ? 0 : deltaX),
        y: componente.y + (eixo === "horizontal" ? 0 : deltaY),
      },
    ]));
    return {
      ...registrarHistorico(state),
      componentes: atualizarMultiplosNaArvore(state.componentes, patches),
      ...estadoAlterado(state),
    };
  }),

  iniciarTransacaoHistorico: () => set((state) => {
    if (profundidadeTransacaoHistorico === 0) snapshotTransacaoHistorico = capturarEstadoEditavel(state);
    profundidadeTransacaoHistorico += 1;
    return state;
  }),
  finalizarTransacaoHistorico: () => set((state) => {
    if (profundidadeTransacaoHistorico === 0) return state;
    profundidadeTransacaoHistorico -= 1;
    if (profundidadeTransacaoHistorico > 0 || !snapshotTransacaoHistorico) return state;
    const snapshot = snapshotTransacaoHistorico;
    snapshotTransacaoHistorico = null;
    if (estadosIguais(snapshot, capturarEstadoEditavel(state))) return state;
    return {
      historicoPassado: [...state.historicoPassado, snapshot].slice(-LIMITE_HISTORICO),
      historicoFuturo: [],
    };
  }),
  desfazer: () => set((state) => {
    const anterior = state.historicoPassado.at(-1);
    if (!anterior) return state;
    const componentes = clonar(anterior.componentes);
    return {
      ...clonar(anterior),
      ...selecaoValida(state, componentes),
      historicoPassado: state.historicoPassado.slice(0, -1),
      historicoFuturo: [capturarEstadoEditavel(state), ...state.historicoFuturo].slice(0, LIMITE_HISTORICO),
      ...estadoAlterado(state),
    };
  }),
  refazer: () => set((state) => {
    const proximo = state.historicoFuturo[0];
    if (!proximo) return state;
    const componentes = clonar(proximo.componentes);
    return {
      ...clonar(proximo),
      ...selecaoValida(state, componentes),
      historicoPassado: [...state.historicoPassado, capturarEstadoEditavel(state)].slice(-LIMITE_HISTORICO),
      historicoFuturo: state.historicoFuturo.slice(1),
      ...estadoAlterado(state),
    };
  }),

  setZoom: (zoom) => set({ zoom: Math.min(4, Math.max(0.25, zoom)) }),
  setGuiasAlinhamento: (guiasAlinhamento) => set({ guiasAlinhamento }),
  redimensionarCanvas: (canvas) => set((state) => ({
    ...registrarHistorico(state),
    componentes: ajustarFundosAoCanvas(adaptarComponentesAoCanvas(state.componentes, state.canvas, canvas), canvas),
    canvas,
    componenteSelecionadoId: null,
    componentesSelecionadosIds: [],
    ...estadoAlterado(state),
  })),
  atualizarFundoCanvas: (backgroundColor) => set((state) => ({
    ...registrarHistorico(state),
    canvas: { ...state.canvas, backgroundColor, backgroundImage: undefined },
    ...estadoAlterado(state),
  })),
  atualizarTransicaoSlide: (transicaoEntrada) => set((state) => ({
    ...registrarHistorico(state),
    transicaoEntrada,
    ...estadoAlterado(state),
  })),

  adicionarAnimacaoElemento: (animacao) => set((state) => {
    const timelineAtual = state.animacaoConfig?.timeline ?? { duration: 0, animations: [] };
    return {
      ...registrarHistorico(state),
      animacaoConfig: {
        version: state.animacaoConfig?.version ?? 1,
        ...state.animacaoConfig,
        timeline: { ...timelineAtual, animations: [...timelineAtual.animations, animacao] },
      },
      ...estadoAlterado(state),
    };
  }),
  adicionarAnimacoesElementos: (animacoes) => set((state) => {
    if (animacoes.length === 0) return state;
    const timelineAtual = state.animacaoConfig?.timeline ?? { duration: 0, animations: [] };
    return {
      ...registrarHistorico(state),
      animacaoConfig: {
        version: state.animacaoConfig?.version ?? 1,
        ...state.animacaoConfig,
        timeline: { ...timelineAtual, animations: [...timelineAtual.animations, ...animacoes] },
      },
      ...estadoAlterado(state),
    };
  }),
  removerAnimacaoElemento: (animacaoId) => set((state) => {
    if (!state.animacaoConfig?.timeline) return state;
    return {
      ...registrarHistorico(state),
      animacaoConfig: {
        ...state.animacaoConfig,
        timeline: { ...state.animacaoConfig.timeline, animations: state.animacaoConfig.timeline.animations.filter((a) => a.id !== animacaoId) },
      },
      ...estadoAlterado(state),
    };
  }),
  atualizarAnimacaoElemento: (id, patch) => set((state) => {
    if (!state.animacaoConfig?.timeline) return state;
    return {
      ...registrarHistorico(state),
      animacaoConfig: {
        ...state.animacaoConfig,
        timeline: { ...state.animacaoConfig.timeline, animations: state.animacaoConfig.timeline.animations.map((a) => (a.id === id ? { ...a, ...patch } : a)) },
      },
      ...estadoAlterado(state),
    };
  }),
  reordenarAnimacoesElemento: (elementId, novaOrdemIds) => set((state) => {
    if (!state.animacaoConfig?.timeline) return state;
    const posicaoPorId = new Map(novaOrdemIds.map((id, index) => [id, index]));
    return {
      ...registrarHistorico(state),
      animacaoConfig: {
        ...state.animacaoConfig,
        timeline: {
          ...state.animacaoConfig.timeline,
          animations: state.animacaoConfig.timeline.animations.map((a) =>
            a.elementId === elementId && posicaoPorId.has(a.id) ? { ...a, order: posicaoPorId.get(a.id)! } : a,
          ),
        },
      },
      ...estadoAlterado(state),
    };
  }),
  agruparAnimacoes: (animacaoIds, nomeGrupo) => set((state) => {
    const timelineAtual = state.animacaoConfig?.timeline ?? { duration: 0, animations: [] };
    const novoGrupo: AnimationGroup = { id: `grupo-${crypto.randomUUID()}`, nome: nomeGrupo, animationIds: animacaoIds };
    return {
      ...registrarHistorico(state),
      animacaoConfig: {
        version: state.animacaoConfig?.version ?? 1,
        ...state.animacaoConfig,
        timeline: { ...timelineAtual, groups: [...(timelineAtual.groups ?? []), novoGrupo] },
      },
      ...estadoAlterado(state),
    };
  }),
  desagruparAnimacoes: (grupoId) => set((state) => {
    if (!state.animacaoConfig?.timeline?.groups) return state;
    return {
      ...registrarHistorico(state),
      animacaoConfig: {
        ...state.animacaoConfig,
        timeline: { ...state.animacaoConfig.timeline, groups: state.animacaoConfig.timeline.groups.filter((g) => g.id !== grupoId) },
      },
      ...estadoAlterado(state),
    };
  }),

  marcarSujo: () => set((state) => ({ ...registrarHistorico(state), ...estadoAlterado(state) })),
  marcarSalvo: () => set({ isDirty: false, isSaving: false }),
  concluirSalvamento: (slideId, versao, sucesso) => set((state) => {
    const snapshotAindaAtual = state.slideAtivoId === slideId && state.versaoEdicao === versao;
    if (!snapshotAindaAtual) return { isSaving: state.isDirty };
    return { isDirty: sucesso ? false : state.isDirty, isSaving: false };
  }),
  setSaving: (saving) => set({ isSaving: saving }),
}));
