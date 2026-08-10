import { beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/components/Apresentacoes/Editor/store/useEditorStore";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import { CANVAS_PADRAO } from "@/lib/apresentacoes/canvas";

function texto(id: string, x: number, y: number, zIndex: number): ComponenteSlide {
  return { id, tipo: "texto", texto: id, tag: "p", x, y, w: 100, h: 50, zIndex, rotacao: 0 };
}

describe("Alpha Motion — histórico, multisseleção e camadas", () => {
  beforeEach(() => {
    useEditorStore.setState({
      slideAtivoId: "slide-1",
      componentes: [texto("a", 10, 20, 1), texto("b", 210, 120, 2)],
      canvas: CANVAS_PADRAO,
      animacaoConfig: undefined,
      transicaoEntrada: null,
      componenteSelecionadoId: null,
      componentesSelecionadosIds: [],
      historicoPassado: [],
      historicoFuturo: [],
      isDirty: false,
      versaoEdicao: 0,
    });
  });

  it("desfaz e refaz uma alteração do componente", () => {
    useEditorStore.getState().atualizarComponente("a", { x: 80, rotacao: 45 });
    expect(useEditorStore.getState().historicoPassado).toHaveLength(1);
    expect(useEditorStore.getState().componentes[0]).toMatchObject({ x: 80, rotacao: 45 });
    useEditorStore.getState().desfazer();
    expect(useEditorStore.getState().componentes[0]).toMatchObject({ x: 10, rotacao: 0 });
    expect(useEditorStore.getState().historicoFuturo).toHaveLength(1);
    useEditorStore.getState().refazer();
    expect(useEditorStore.getState().componentes[0]).toMatchObject({ x: 80, rotacao: 45 });
  });

  it("consolida várias atualizações de um gesto em um único passo", () => {
    const store = useEditorStore.getState();
    store.selecionarComponente("a");
    store.selecionarComponente("b", true);
    store.iniciarTransacaoHistorico();
    store.moverComponentes([{ id: "a", x: 10, y: 20 }, { id: "b", x: 210, y: 120 }], 20, 30);
    store.moverComponentes([{ id: "a", x: 10, y: 20 }, { id: "b", x: 210, y: 120 }], 50, 60);
    store.finalizarTransacaoHistorico();

    expect(useEditorStore.getState().historicoPassado).toHaveLength(1);
    expect(useEditorStore.getState().componentes).toEqual([
      expect.objectContaining({ id: "a", x: 60, y: 80 }),
      expect.objectContaining({ id: "b", x: 260, y: 180 }),
    ]);
    useEditorStore.getState().desfazer();
    expect(useEditorStore.getState().componentes).toEqual([
      expect.objectContaining({ id: "a", x: 10, y: 20 }),
      expect.objectContaining({ id: "b", x: 210, y: 120 }),
    ]);
  });

  it("alterna seleção aditiva com Ctrl/Cmd", () => {
    const store = useEditorStore.getState();
    store.selecionarComponente("a");
    store.selecionarComponente("b", true);
    expect(useEditorStore.getState().componentesSelecionadosIds).toEqual(["a", "b"]);
    store.selecionarComponente("a", true);
    expect(useEditorStore.getState()).toMatchObject({ componenteSelecionadoId: "b", componentesSelecionadosIds: ["b"] });
  });

  it("reordena zIndex conforme a ordem topo para base e permite desfazer", () => {
    useEditorStore.getState().reordenarCamadas(["a", "b"]);
    const [a, b] = useEditorStore.getState().componentes;
    expect(a.zIndex).toBeGreaterThan(b.zIndex);
    useEditorStore.getState().desfazer();
    expect(useEditorStore.getState().componentes).toEqual([
      expect.objectContaining({ id: "a", zIndex: 1 }),
      expect.objectContaining({ id: "b", zIndex: 2 }),
    ]);
  });

  it("excluir elemento remove também suas animações", () => {
    useEditorStore.setState({
      animacaoConfig: {
        version: 1,
        timeline: {
          duration: 2,
          animations: [
            { id: "anim-a", elementId: "a", type: "fade-in", category: "entrance", trigger: "on-slide-enter", duration: 1, delay: 0, easing: { curva: "easeOut" }, order: 0 },
            { id: "anim-b", elementId: "b", type: "fade-in", category: "entrance", trigger: "on-slide-enter", duration: 1, delay: 0, easing: { curva: "easeOut" }, order: 0 },
          ],
        },
      },
    });
    useEditorStore.getState().removerComponente("a");
    expect(useEditorStore.getState().componentes.map((componente) => componente.id)).toEqual(["b"]);
    expect(useEditorStore.getState().animacaoConfig?.timeline?.animations.map((animacao) => animacao.id)).toEqual(["anim-b"]);
  });

  it("centraliza o conjunto preservando a distância relativa", () => {
    const store = useEditorStore.getState();
    store.selecionarComponente("a");
    store.selecionarComponente("b", true);
    const distanciaAntes = store.componentes[1].x - store.componentes[0].x;
    store.centralizarSelecionados();
    const [a, b] = useEditorStore.getState().componentes;
    expect(b.x - a.x).toBe(distanciaAntes);
    expect((Math.min(a.x, b.x) + Math.max(a.x + a.w, b.x + b.w)) / 2).toBe(CANVAS_PADRAO.width / 2);
  });
});
