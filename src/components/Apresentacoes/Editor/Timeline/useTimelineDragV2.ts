import { useCallback, useRef } from "react";
import { useEditorStore } from "../store/useEditorStore";
import type { ElementAnimation } from "@/lib/apresentacoes/animacao/tipos";

const MIN_DURACAO = 0.1;

/**
 * Drag/resize de barra de tempo para o NOVO modelo (`ElementAnimation`, Fase 04) — mesmo
 * espírito de `useTimelineDrag.ts` (mouse events próprios, 1 eixo=tempo), mas grava via
 * `atualizarAnimacaoElemento` (update in-place, sem remove+add) em vez de `atualizarComponente`.
 *
 * Segue o MESMO padrão real já usado em todo o editor (`useCanvasDragResize.ts`,
 * `useTimelineDrag.ts`): atualiza a cada `mousemove`, sem "commit só ao soltar" — este
 * projeto não tem sistema de undo/redo real (decisão registrada em
 * `.bibble/memory/decisions.md`, 2026-08-06), então não há uma pilha de histórico para
 * proteger de múltiplas entradas.
 */
export function useTimelineDragV2(animacao: ElementAnimation, pixelsPorSegundo: number, maxTempo: number) {
  const atualizarAnimacaoElemento = useEditorStore((s) => s.atualizarAnimacaoElemento);
  const arrastando = useRef<{ startX: number; origemDelay: number } | null>(null);
  const redimensionando = useRef<{ startX: number; origemDuracao: number } | null>(null);

  const onMouseDownMover = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      arrastando.current = { startX: e.clientX, origemDelay: animacao.delay };

      function onMove(ev: MouseEvent) {
        if (!arrastando.current) return;
        const deltaSegundos = (ev.clientX - arrastando.current.startX) / pixelsPorSegundo;
        const novoDelay = Math.min(maxTempo, Math.max(0, arrastando.current.origemDelay + deltaSegundos));
        atualizarAnimacaoElemento(animacao.id, { delay: novoDelay });
      }
      function onUp() {
        arrastando.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [animacao.id, animacao.delay, atualizarAnimacaoElemento, pixelsPorSegundo, maxTempo],
  );

  const onMouseDownRedimensionar = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      redimensionando.current = { startX: e.clientX, origemDuracao: animacao.duration };

      function onMove(ev: MouseEvent) {
        if (!redimensionando.current) return;
        const deltaSegundos = (ev.clientX - redimensionando.current.startX) / pixelsPorSegundo;
        const novaDuracao = Math.min(maxTempo, Math.max(MIN_DURACAO, redimensionando.current.origemDuracao + deltaSegundos));
        atualizarAnimacaoElemento(animacao.id, { duration: novaDuracao });
      }
      function onUp() {
        redimensionando.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [animacao.id, animacao.duration, atualizarAnimacaoElemento, pixelsPorSegundo, maxTempo],
  );

  return { onMouseDownMover, onMouseDownRedimensionar };
}
