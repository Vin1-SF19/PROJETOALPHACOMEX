import { useCallback, useRef } from "react";
import { useEditorStore } from "../store/useEditorStore";
import type { ElementAnimation } from "@/lib/apresentacoes/animacao/tipos";

const MIN_DURACAO = 0.1;

/**
 * Drag/resize de barra de tempo para o NOVO modelo (`ElementAnimation`, Fase 04) — mesmo
 * espírito de `useTimelineDrag.ts` (mouse events próprios, 1 eixo=tempo), mas grava via
 * `atualizarAnimacaoElemento` (update in-place, sem remove+add) em vez de `atualizarComponente`.
 *
 * Atualiza a cada `mousemove`, mas abre uma transação para o gesto inteiro ocupar somente
 * uma entrada da pilha Undo/Redo ao soltar o mouse.
 */
export function useTimelineDragV2(animacao: ElementAnimation, pixelsPorSegundo: number, maxTempo: number) {
  const atualizarAnimacaoElemento = useEditorStore((s) => s.atualizarAnimacaoElemento);
  const iniciarTransacaoHistorico = useEditorStore((s) => s.iniciarTransacaoHistorico);
  const finalizarTransacaoHistorico = useEditorStore((s) => s.finalizarTransacaoHistorico);
  const arrastando = useRef<{ startX: number; origemDelay: number } | null>(null);
  const redimensionando = useRef<{ startX: number; origemDuracao: number } | null>(null);

  const onMouseDownMover = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      iniciarTransacaoHistorico();
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
        finalizarTransacaoHistorico();
      }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [animacao.id, animacao.delay, atualizarAnimacaoElemento, finalizarTransacaoHistorico, iniciarTransacaoHistorico, pixelsPorSegundo, maxTempo],
  );

  const onMouseDownRedimensionar = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      iniciarTransacaoHistorico();
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
        finalizarTransacaoHistorico();
      }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [animacao.id, animacao.duration, atualizarAnimacaoElemento, finalizarTransacaoHistorico, iniciarTransacaoHistorico, pixelsPorSegundo, maxTempo],
  );

  return { onMouseDownMover, onMouseDownRedimensionar };
}
