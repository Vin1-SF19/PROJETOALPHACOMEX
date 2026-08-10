import { beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/components/Apresentacoes/Editor/store/useEditorStore";
import type { ComponenteSlide, FundoAnimadoComponente } from "@/lib/validations/slide-componentes";
import { CANVAS_PADRAO } from "@/lib/apresentacoes/canvas";

function texto(id: string, x: number, y: number, zIndex: number): ComponenteSlide {
  return { id, tipo: "texto", texto: id, tag: "p", x, y, w: 100, h: 50, zIndex, rotacao: 0 };
}

function fundo(id: string, estilo: FundoAnimadoComponente["estilo"] = "radar"): FundoAnimadoComponente {
  return {
    id, tipo: "fundoAnimado", x: 99, y: 77, w: 300, h: 200, zIndex: 50, rotacao: 25,
    estilo, corPrimaria: "#4f46e5", corSecundaria: "#0ea5e9", velocidade: 1, densidade: 1,
    direcao: "horario", intensidade: 1, mostrarSol: true, quantidadePlanetas: 8,
    mostrarGrade: true, mostrarRelogio: false,
  };
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
      guiasAlinhamento: { verticais: [], horizontais: [] },
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

  it("centraliza apenas no eixo horizontal sem alterar Y", () => {
    const store = useEditorStore.getState();
    store.selecionarComponente("a");
    store.selecionarComponente("b", true);
    const ysAntes = store.componentes.map((componente) => componente.y);
    store.centralizarSelecionados("horizontal");
    const [a, b] = useEditorStore.getState().componentes;
    expect([a.y, b.y]).toEqual(ysAntes);
    expect((Math.min(a.x, b.x) + Math.max(a.x + a.w, b.x + b.w)) / 2).toBe(CANVAS_PADRAO.width / 2);
  });

  it("centraliza apenas no eixo vertical sem alterar X", () => {
    const store = useEditorStore.getState();
    store.selecionarComponente("a");
    store.selecionarComponente("b", true);
    const xsAntes = store.componentes.map((componente) => componente.x);
    store.centralizarSelecionados("vertical");
    const [a, b] = useEditorStore.getState().componentes;
    expect([a.x, b.x]).toEqual(xsAntes);
    expect((Math.min(a.y, b.y) + Math.max(a.y + a.h, b.y + b.h)) / 2).toBe(CANVAS_PADRAO.height / 2);
  });

  it("aplica um unico fundo fixo, limpa a selecao e o ajusta ao canvas", () => {
    useEditorStore.setState({
      componentes: [fundo("antigo"), texto("a", 10, 20, 1)],
      componenteSelecionadoId: "a",
      componentesSelecionadosIds: ["a"],
    });

    useEditorStore.getState().aplicarFundo(fundo("novo", "estelar"));
    let estado = useEditorStore.getState();
    const fundos = estado.componentes.filter((componente) => componente.tipo === "fundoAnimado");
    expect(fundos).toHaveLength(1);
    expect(fundos[0]).toMatchObject({ id: "novo", x: 0, y: 0, w: CANVAS_PADRAO.width, h: CANVAS_PADRAO.height, rotacao: 0 });
    expect(estado.componentesSelecionadosIds).toEqual([]);

    estado.desfazer();
    expect(useEditorStore.getState().componentes.some((componente) => componente.id === "antigo")).toBe(true);
    useEditorStore.getState().refazer();

    useEditorStore.getState().redimensionarCanvas({ ...CANVAS_PADRAO, width: 900, height: 1600 });
    estado = useEditorStore.getState();
    expect(estado.componentes.find((componente) => componente.id === "novo")).toMatchObject({ x: 0, y: 0, w: 900, h: 1600, rotacao: 0 });
  });

  it("mantem o fundo abaixo dos elementos ao reordenar camadas", () => {
    useEditorStore.setState({ componentes: [fundo("bg"), texto("a", 10, 20, 1), texto("b", 210, 120, 2)] });
    useEditorStore.getState().reordenarCamadas(["a", "bg", "b"]);
    const estado = useEditorStore.getState();
    const bg = estado.componentes.find((componente) => componente.id === "bg")!;
    const elementos = estado.componentes.filter((componente) => componente.tipo !== "fundoAnimado");
    expect(elementos.every((componente) => componente.zIndex > bg.zIndex)).toBe(true);
  });
});
