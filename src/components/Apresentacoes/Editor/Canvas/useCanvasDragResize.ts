import { useCallback, useEffect, useRef } from "react";
import { useEditorStore } from "../store/useEditorStore";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";

type HandlePosicao = "nw" | "ne" | "sw" | "se";

const MIN_TAMANHO = 20;

function ehContainer(c: ComponenteSlide): c is Extract<ComponenteSlide, { tipo: "card" | "grid" | "container" }> {
  return c.tipo === "card" || c.tipo === "grid" || c.tipo === "container";
}

function coletarOrigensMoviveis(
  lista: ComponenteSlide[],
  idsSelecionados: Set<string>,
  ancestralSelecionado = false,
): Array<{ id: string; x: number; y: number }> {
  const origens: Array<{ id: string; x: number; y: number }> = [];
  for (const componente of lista) {
    const selecionado = idsSelecionados.has(componente.id);
    if (selecionado && !ancestralSelecionado) origens.push({ id: componente.id, x: componente.x, y: componente.y });
    if (ehContainer(componente)) {
      origens.push(...coletarOrigensMoviveis(componente.filhos, idsSelecionados, ancestralSelecionado || selecionado));
    }
  }
  return origens;
}

/** Drag/resize/rotação livre, sempre consolidado em uma única entrada de histórico por gesto. */
export function useCanvasDragResize(componenteId: string, x: number, y: number, w: number, h: number, rotacao: number) {
  const atualizarComponente = useEditorStore((s) => s.atualizarComponente);
  const moverComponentes = useEditorStore((s) => s.moverComponentes);
  const iniciarTransacaoHistorico = useEditorStore((s) => s.iniciarTransacaoHistorico);
  const finalizarTransacaoHistorico = useEditorStore((s) => s.finalizarTransacaoHistorico);
  const zoom = useEditorStore((s) => s.zoom);
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const arrastando = useRef<{
    startX: number;
    startY: number;
    origens: Array<{ id: string; x: number; y: number }>;
  } | null>(null);
  const redimensionando = useRef<{
    startX: number;
    startY: number;
    origemX: number;
    origemY: number;
    origemW: number;
    origemH: number;
    handle: HandlePosicao;
  } | null>(null);
  const rotacionando = useRef<{ centroX: number; centroY: number; anguloInicial: number; rotacaoInicial: number } | null>(null);

  const onMouseDownMover = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const estado = useEditorStore.getState();
    const ids = estado.componentesSelecionadosIds.includes(componenteId)
      ? estado.componentesSelecionadosIds
      : [componenteId];
    const origens = coletarOrigensMoviveis(estado.componentes, new Set(ids));
    iniciarTransacaoHistorico();
    arrastando.current = { startX: e.clientX, startY: e.clientY, origens };

    function onMove(ev: MouseEvent) {
      if (!arrastando.current) return;
      const deltaX = (ev.clientX - arrastando.current.startX) / zoomRef.current;
      const deltaY = (ev.clientY - arrastando.current.startY) / zoomRef.current;
      moverComponentes(arrastando.current.origens, deltaX, deltaY);
    }
    function onUp() {
      arrastando.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      finalizarTransacaoHistorico();
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [componenteId, finalizarTransacaoHistorico, iniciarTransacaoHistorico, moverComponentes]);

  const onMouseDownRedimensionar = useCallback((handle: HandlePosicao) => (e: React.MouseEvent) => {
    e.stopPropagation();
    iniciarTransacaoHistorico();
    redimensionando.current = { startX: e.clientX, startY: e.clientY, origemX: x, origemY: y, origemW: w, origemH: h, handle };

    function onMove(ev: MouseEvent) {
      if (!redimensionando.current) return;
      const { startX, startY, origemX, origemY, origemW, origemH, handle: handleAtual } = redimensionando.current;
      const deltaX = (ev.clientX - startX) / zoomRef.current;
      const deltaY = (ev.clientY - startY) / zoomRef.current;
      let novoX = origemX;
      let novoY = origemY;
      let novoW = origemW;
      let novoH = origemH;

      if (handleAtual === "se") { novoW = Math.max(MIN_TAMANHO, origemW + deltaX); novoH = Math.max(MIN_TAMANHO, origemH + deltaY); }
      if (handleAtual === "sw") { novoW = Math.max(MIN_TAMANHO, origemW - deltaX); novoH = Math.max(MIN_TAMANHO, origemH + deltaY); novoX = origemX + (origemW - novoW); }
      if (handleAtual === "ne") { novoW = Math.max(MIN_TAMANHO, origemW + deltaX); novoH = Math.max(MIN_TAMANHO, origemH - deltaY); novoY = origemY + (origemH - novoH); }
      if (handleAtual === "nw") { novoW = Math.max(MIN_TAMANHO, origemW - deltaX); novoH = Math.max(MIN_TAMANHO, origemH - deltaY); novoX = origemX + (origemW - novoW); novoY = origemY + (origemH - novoH); }
      atualizarComponente(componenteId, { x: novoX, y: novoY, w: novoW, h: novoH });
    }
    function onUp() {
      redimensionando.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      finalizarTransacaoHistorico();
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [atualizarComponente, componenteId, finalizarTransacaoHistorico, h, iniciarTransacaoHistorico, w, x, y]);

  const onMouseDownRotacionar = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const caixa = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!caixa) return;
    const centroX = caixa.left + caixa.width / 2;
    const centroY = caixa.top + caixa.height / 2;
    const anguloInicial = Math.atan2(e.clientY - centroY, e.clientX - centroX) * (180 / Math.PI);
    iniciarTransacaoHistorico();
    rotacionando.current = { centroX, centroY, anguloInicial, rotacaoInicial: rotacao };

    function onMove(ev: MouseEvent) {
      if (!rotacionando.current) return;
      const anguloAtual = Math.atan2(ev.clientY - rotacionando.current.centroY, ev.clientX - rotacionando.current.centroX) * (180 / Math.PI);
      const novaRotacao = rotacionando.current.rotacaoInicial + anguloAtual - rotacionando.current.anguloInicial;
      atualizarComponente(componenteId, { rotacao: Math.round(novaRotacao * 10) / 10 });
    }
    function onUp() {
      rotacionando.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      finalizarTransacaoHistorico();
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [atualizarComponente, componenteId, finalizarTransacaoHistorico, iniciarTransacaoHistorico, rotacao]);

  return { onMouseDownMover, onMouseDownRedimensionar, onMouseDownRotacionar };
}
