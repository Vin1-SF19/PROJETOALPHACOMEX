import { useCallback, useEffect, useRef } from "react";
import { useEditorStore } from "../store/useEditorStore";

type HandlePosicao = "nw" | "ne" | "sw" | "se";

const MIN_TAMANHO = 20;

/**
 * Drag/resize livre em X/Y, feito com mouse events próprios — @dnd-kit é uma lib
 * de reordenação/colisão, não de posicionamento livre com resize (decisão de
 * arquitetura de Scout, ver blueprint da Onda 2). O zoom do canvas é considerado
 * dividindo o delta do mouse pelo fator de zoom, senão mover/redimensionar fica
 * "acelerado" ou "lento" conforme o zoom aplicado.
 */
export function useCanvasDragResize(componenteId: string, x: number, y: number, w: number, h: number) {
  const atualizarComponente = useEditorStore((s) => s.atualizarComponente);
  const zoom = useEditorStore((s) => s.zoom);
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const arrastando = useRef<{ startX: number; startY: number; origemX: number; origemY: number } | null>(null);
  const redimensionando = useRef<{
    startX: number;
    startY: number;
    origemX: number;
    origemY: number;
    origemW: number;
    origemH: number;
    handle: HandlePosicao;
  } | null>(null);

  const onMouseDownMover = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      arrastando.current = { startX: e.clientX, startY: e.clientY, origemX: x, origemY: y };

      function onMove(ev: MouseEvent) {
        if (!arrastando.current) return;
        const zoom = zoomRef.current;
        const deltaX = (ev.clientX - arrastando.current.startX) / zoom;
        const deltaY = (ev.clientY - arrastando.current.startY) / zoom;
        atualizarComponente(componenteId, {
          x: arrastando.current.origemX + deltaX,
          y: arrastando.current.origemY + deltaY,
        });
      }
      function onUp() {
        arrastando.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [atualizarComponente, componenteId, x, y],
  );

  const onMouseDownRedimensionar = useCallback(
    (handle: HandlePosicao) => (e: React.MouseEvent) => {
      e.stopPropagation();
      redimensionando.current = { startX: e.clientX, startY: e.clientY, origemX: x, origemY: y, origemW: w, origemH: h, handle };

      function onMove(ev: MouseEvent) {
        if (!redimensionando.current) return;
        const { startX, startY, origemX, origemY, origemW, origemH, handle: h2 } = redimensionando.current;
        const zoom = zoomRef.current;
        const deltaX = (ev.clientX - startX) / zoom;
        const deltaY = (ev.clientY - startY) / zoom;

        let novoX = origemX, novoY = origemY, novoW = origemW, novoH = origemH;

        if (h2 === "se") { novoW = Math.max(MIN_TAMANHO, origemW + deltaX); novoH = Math.max(MIN_TAMANHO, origemH + deltaY); }
        if (h2 === "sw") { novoW = Math.max(MIN_TAMANHO, origemW - deltaX); novoH = Math.max(MIN_TAMANHO, origemH + deltaY); novoX = origemX + (origemW - novoW); }
        if (h2 === "ne") { novoW = Math.max(MIN_TAMANHO, origemW + deltaX); novoH = Math.max(MIN_TAMANHO, origemH - deltaY); novoY = origemY + (origemH - novoH); }
        if (h2 === "nw") { novoW = Math.max(MIN_TAMANHO, origemW - deltaX); novoH = Math.max(MIN_TAMANHO, origemH - deltaY); novoX = origemX + (origemW - novoW); novoY = origemY + (origemH - novoH); }

        atualizarComponente(componenteId, { x: novoX, y: novoY, w: novoW, h: novoH });
      }
      function onUp() {
        redimensionando.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [atualizarComponente, componenteId, x, y, w, h],
  );

  return { onMouseDownMover, onMouseDownRedimensionar };
}
