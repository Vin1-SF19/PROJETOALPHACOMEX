import { useCallback, useRef } from "react";
import { useEditorStore } from "../store/useEditorStore";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";

const PIXELS_POR_SEGUNDO = 80;
const MIN_DURACAO = 0.1;
const MAX_TEMPO = 5;

/**
 * Drag/resize de barra de tempo — mesmo espírito de Canvas/useCanvasDragResize.ts
 * (mouse events próprios), mas em 1 eixo só (X = tempo), sem resize em Y.
 * Atualiza `componente.animacao.entrada.delay`/`.duracao` na store.
 */
export function useTimelineDrag(componente: ComponenteSlide) {
  const atualizarComponente = useEditorStore((s) => s.atualizarComponente);
  const iniciarTransacaoHistorico = useEditorStore((s) => s.iniciarTransacaoHistorico);
  const finalizarTransacaoHistorico = useEditorStore((s) => s.finalizarTransacaoHistorico);
  const anim = componente.animacao?.entrada;
  const arrastando = useRef<{ startX: number; origemDelay: number; modo: "mover" | "redimensionar" } | null>(null);

  const onMouseDownMover = useCallback(
    (e: React.MouseEvent) => {
      if (!anim || anim.tipo === "container-alpha") return;
      const animAtual = anim;
      e.stopPropagation();
      iniciarTransacaoHistorico();
      arrastando.current = { startX: e.clientX, origemDelay: animAtual.delay, modo: "mover" };

      function onMove(ev: MouseEvent) {
        if (!arrastando.current) return;
        const deltaSegundos = (ev.clientX - arrastando.current.startX) / PIXELS_POR_SEGUNDO;
        const novoDelay = Math.min(MAX_TEMPO, Math.max(0, arrastando.current.origemDelay + deltaSegundos));
        atualizarComponente(componente.id, { animacao: { ...componente.animacao, entrada: { ...animAtual, delay: novoDelay } } });
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
    [anim, atualizarComponente, componente, finalizarTransacaoHistorico, iniciarTransacaoHistorico],
  );

  const onMouseDownRedimensionar = useCallback(
    (e: React.MouseEvent) => {
      if (!anim || anim.tipo === "container-alpha") return;
      const animAtual = anim;
      e.stopPropagation();
      iniciarTransacaoHistorico();
      arrastando.current = { startX: e.clientX, origemDelay: animAtual.duracao, modo: "redimensionar" };

      function onMove(ev: MouseEvent) {
        if (!arrastando.current) return;
        const deltaSegundos = (ev.clientX - arrastando.current.startX) / PIXELS_POR_SEGUNDO;
        const novaDuracao = Math.min(5, Math.max(MIN_DURACAO, arrastando.current.origemDelay + deltaSegundos));
        atualizarComponente(componente.id, { animacao: { ...componente.animacao, entrada: { ...animAtual, duracao: novaDuracao } } });
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
    [anim, atualizarComponente, componente, finalizarTransacaoHistorico, iniciarTransacaoHistorico],
  );

  return { onMouseDownMover, onMouseDownRedimensionar, PIXELS_POR_SEGUNDO };
}
