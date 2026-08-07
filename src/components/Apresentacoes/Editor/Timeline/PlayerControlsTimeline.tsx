import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, SkipForward } from "lucide-react";
import { criarAnimationController } from "@/lib/apresentacoes/animacao/motor";
import { resolverOrdemExecucao, calcularDelaysEfetivos, resolucaoOrdemEhErro } from "@/lib/apresentacoes/animacao/gatilhos";
import type { ElementAnimation } from "@/lib/apresentacoes/animacao/tipos";

const PASSO_QUADRO = 0.1;

/**
 * PRIMEIRO consumidor real do `AnimationController` (Fase 01 — até esta fase, motor.ts não
 * tinha nenhum uso fora de testes). Controla e reporta STATE (tempo atual, play/pause,
 * posição do cursor) — mas ainda NÃO anima o canvas do editor de verdade: conectar o motor
 * ao `RenderEngine` para animação visual real durante o playback é trabalho de fase futura
 * (Modo Apresentação/Export já fazem isso via Framer Motion declarativo direto; a Fase 04
 * entrega a prova de mecanismo do motor imperativo, não substitui esse caminho).
 */
interface PlayerControlsTimelineProps {
  animacoes: ElementAnimation[];
  duracaoTotal: number;
  cursor: number;
  onCursorChange: (tempo: number) => void;
}

export function PlayerControlsTimeline({ animacoes, duracaoTotal, cursor, onCursorChange }: PlayerControlsTimelineProps) {
  const [tocando, setTocando] = useState(false);
  const [tempoAtual, setTempoAtual] = useState(cursor);
  const rafRef = useRef<number | null>(null);
  const inicioRealRef = useRef<number>(0);
  const inicioTempoRef = useRef<number>(0);
  const controllersRef = useRef<ReturnType<typeof criarAnimationController>[]>([]);

  const pararControllers = useCallback(() => {
    for (const controller of controllersRef.current) controller.destroy();
    controllersRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      pararControllers();
    };
  }, [pararControllers]);

  // Padrão "latest ref" (ver `known-errors.md`, `NotificationToast.tsx`): `tick` se
  // autorreferencia via `requestAnimationFrame`, o que o linter bloqueia se declarado direto
  // num `useCallback` (`Cannot access variable before it is declared`).
  const tickRef = useRef<() => void>(() => {});
  useEffect(() => {
    tickRef.current = () => {
      const decorrido = (performance.now() - inicioRealRef.current) / 1000;
      const novoTempo = inicioTempoRef.current + decorrido;
      if (novoTempo >= duracaoTotal) {
        setTempoAtual(duracaoTotal);
        setTocando(false);
        pararControllers();
        return;
      }
      setTempoAtual(novoTempo);
      rafRef.current = requestAnimationFrame(() => tickRef.current());
    };
  }, [duracaoTotal, pararControllers]);

  function play() {
    const resolucao = resolverOrdemExecucao(animacoes);
    if (resolucaoOrdemEhErro(resolucao)) return; // dependência circular — nunca trava, só não reproduz (Seção 29)

    const delays = calcularDelaysEfetivos(resolucao.ordenadas);
    pararControllers();
    controllersRef.current = resolucao.ordenadas
      .filter((anim) => (delays.get(anim.id) ?? anim.delay) >= tempoAtual)
      .map((anim) => criarAnimationController(anim));
    for (const controller of controllersRef.current) controller.play();

    inicioRealRef.current = performance.now();
    inicioTempoRef.current = tempoAtual;
    setTocando(true);
    rafRef.current = requestAnimationFrame(() => tickRef.current());
  }

  function pausar() {
    setTocando(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    for (const controller of controllersRef.current) controller.pause();
  }

  function reiniciar() {
    pausar();
    setTempoAtual(0);
    onCursorChange(0);
  }

  function avancarQuadro() {
    const novoTempo = Math.min(duracaoTotal, tempoAtual + PASSO_QUADRO);
    setTempoAtual(novoTempo);
    onCursorChange(novoTempo);
  }

  return (
    <div className="flex items-center gap-2 border-t border-white/5 px-4 py-1.5">
      <button
        onClick={tocando ? pausar : play}
        aria-label={tocando ? "Pausar" : "Reproduzir a partir do cursor"}
        className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
      >
        {tocando ? <Pause size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
      </button>
      <button
        onClick={reiniciar}
        aria-label="Reiniciar"
        className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
      >
        <RotateCcw size={13} aria-hidden="true" />
      </button>
      <button
        onClick={avancarQuadro}
        aria-label="Avançar quadro"
        className="cursor-pointer rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
      >
        <SkipForward size={13} aria-hidden="true" />
      </button>
      <span className="ml-1 font-mono text-[10px] text-slate-500">
        {tempoAtual.toFixed(1)}s / {duracaoTotal.toFixed(1)}s
      </span>
    </div>
  );
}
