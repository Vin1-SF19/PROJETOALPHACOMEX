"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, X } from "lucide-react";
import type { ContainerIntroEvent } from "@/lib/apresentacoes/container-intro";
import {
  converterDimensoesEntrePalcos,
  criarClipInicialAbertura,
  criarClipInicialContainer,
} from "@/lib/apresentacoes/container-intro";
import { calcularEscalaApresentacao } from "@/lib/apresentacoes/viewport";
import { SlideApresentacaoLayer, type SlideApresentacao } from "./SlideApresentacaoLayer";
import { EntradaContainerAlphaLayer } from "./EntradaContainerAlphaLayer";

interface TemaApresentacao {
  id: string;
  nome: string;
  corPrimaria: string;
  corSecundaria: string;
  corAccent: string;
}

interface ModoApresentacaoClientProps {
  apresentacaoId: string;
  slides: SlideApresentacao[];
  tema: TemaApresentacao | null;
  embutido?: boolean;
}

interface IntroEmCurso {
  id: number;
  origemIndex: number;
  destinoIndex: number;
  clipInicial: string;
  duracao: number;
}

export function ModoApresentacaoClient({
  apresentacaoId,
  slides,
  tema,
  embutido = false,
}: ModoApresentacaoClientProps) {
  const router = useRouter();
  const playerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const indiceAtualRef = useRef(0);
  const introRef = useRef<IntroEmCurso | null>(null);
  const sequenciaIntroRef = useRef(0);
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [intro, setIntro] = useState<IntroEmCurso | null>(null);
  const [escalaSlide, setEscalaSlide] = useState(1);
  const [pausado, setPausado] = useState(false);
  const [entradaConcluida, setEntradaConcluida] = useState(() => !slides[0]?.entradaApresentacao);
  const [sequenciaEntrada, setSequenciaEntrada] = useState(0);
  const [containerCapaTarget, setContainerCapaTarget] = useState<HTMLDivElement | null>(null);
  const pausadoRef = useRef(false);
  const slideAtual = slides[indiceAtual];

  const navegarPara = useCallback((proximoIndice: number) => {
    const limitado = Math.min(Math.max(proximoIndice, 0), slides.length - 1);
    introRef.current = null;
    setIntro(null);
    if (limitado !== 0) setEntradaConcluida(true);
    indiceAtualRef.current = limitado;
    setIndiceAtual(limitado);
  }, [slides.length]);

  const proximoSlide = useCallback(() => {
    navegarPara(indiceAtualRef.current + 1);
  }, [navegarPara]);

  const slideAnterior = useCallback(() => {
    navegarPara(indiceAtualRef.current - 1);
  }, [navegarPara]);

  const reiniciarApresentacao = useCallback(() => {
    navegarPara(0);
    setPausado(false);
    setEntradaConcluida(!slides[0]?.entradaApresentacao);
    setSequenciaEntrada((atual) => atual + 1);
  }, [navegarPara, slides]);

  const concluirEntradaApresentacao = useCallback(() => {
    setEntradaConcluida(true);
  }, []);

  const sair = useCallback(() => {
    if (embutido) {
      window.parent.postMessage({ type: "ALPHA_FECHAR_APRESENTACAO" }, window.location.origin);
      return;
    }
    router.push(`/PainelAlpha/Apresentacoes/${apresentacaoId}/editor`);
  }, [apresentacaoId, embutido, router]);

  const iniciarIntroContainer = useCallback((evento: ContainerIntroEvent) => {
    const origemIndex = indiceAtualRef.current;
    const destinoIndex = origemIndex + 1;
    if (pausadoRef.current || introRef.current || destinoIndex >= slides.length) return;
    const palcoOrigem = { w: slides[origemIndex].canvas.width, h: slides[origemIndex].canvas.height };
    const aberturaNoSlide = evento.abertura && evento.palco
      ? converterDimensoesEntrePalcos(evento.abertura, evento.palco, palcoOrigem)
      : evento.abertura;
    const componenteNoSlide = evento.palco
      ? converterDimensoesEntrePalcos(evento.componente, evento.palco, palcoOrigem)
      : evento.componente;

    sequenciaIntroRef.current += 1;
    const novaIntro: IntroEmCurso = {
      id: sequenciaIntroRef.current,
      origemIndex,
      destinoIndex,
      clipInicial: aberturaNoSlide
        ? criarClipInicialAbertura(aberturaNoSlide, palcoOrigem)
        : criarClipInicialContainer(componenteNoSlide, palcoOrigem),
      duracao: evento.duracao,
    };
    introRef.current = novaIntro;
    indiceAtualRef.current = destinoIndex;
    setIntro(novaIntro);
    setIndiceAtual(destinoIndex);
  }, [slides]);

  const concluirIntro = useCallback(() => {
    if (!introRef.current) return;
    introRef.current = null;
    setIntro(null);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        proximoSlide();
      } else if (event.key === "ArrowLeft") {
        slideAnterior();
      } else if (event.key === " ") {
        event.preventDefault();
        setPausado((atual) => !atual);
      } else if (event.key === "Escape") {
        sair();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [proximoSlide, sair, slideAnterior]);

  useEffect(() => {
    pausadoRef.current = pausado;
    const animations = playerRef.current?.getAnimations({ subtree: true }) ?? [];
    for (const animation of animations) {
      if (pausado) animation.pause();
      else animation.play();
    }
  }, [pausado]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const atualizarEscala = (width: number, height: number) => {
      setEscalaSlide(calcularEscalaApresentacao(width, height, slideAtual.canvas.width, slideAtual.canvas.height));
    };
    atualizarEscala(viewport.clientWidth, viewport.clientHeight);

    const observer = new ResizeObserver(([entry]) => {
      atualizarEscala(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [slideAtual.canvas.height, slideAtual.canvas.width]);

  useEffect(() => {
    if (embutido) return;
    document.documentElement.requestFullscreen?.().catch(() => {
      // A rota continua full-page quando o browser negar fullscreen.
    });
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [embutido]);

  if (!slideAtual) return null;

  const camadas = intro
    ? [
        { slide: slides[intro.origemIndex], indice: intro.origemIndex, zIndex: 1, revelar: false },
        { slide: slides[intro.destinoIndex], indice: intro.destinoIndex, zIndex: 2, revelar: true },
      ]
    : [{ slide: slideAtual, indice: indiceAtual, zIndex: 1, revelar: false }];
  const entradaInicial = slides[0]?.entradaApresentacao ?? null;
  const entradaAtiva = indiceAtual === 0 && entradaInicial !== null && !entradaConcluida;

  return (
    <div
      ref={playerRef}
      className="relative h-screen w-screen overflow-hidden bg-black"
      style={tema ? ({
        "--tema-cor-primaria": tema.corPrimaria,
        "--tema-cor-secundaria": tema.corSecundaria,
        "--tema-cor-accent": tema.corAccent,
      } as React.CSSProperties) : undefined}
    >
      <div
        ref={viewportRef}
        onClick={(event) => {
          if (pausado || (event.target as HTMLElement).closest("button, a, input, textarea, select")) return;
          proximoSlide();
        }}
        className="absolute inset-0 flex items-center justify-center overflow-hidden bg-black"
      >
        <div
          className="relative shrink-0 overflow-hidden bg-slate-900"
          style={{
            width: slideAtual.canvas.width,
            height: slideAtual.canvas.height,
            backgroundColor: slideAtual.canvas.backgroundColor,
            transform: `scale(${escalaSlide})`,
            transformOrigin: "center center",
          }}
        >
          {camadas.map((camada) => (
            <SlideApresentacaoLayer
              key={camada.slide.id}
              slide={camada.slide}
              zIndex={camada.zIndex}
              revelarDoContainer={camada.revelar}
              clipInicial={intro?.clipInicial}
              duracao={intro?.duracao}
              onContainerIntroStart={iniciarIntroContainer}
              onContainerIntroComplete={concluirIntro}
              proximoSlide={slides[camada.indice + 1]}
              pausado={pausado}
              portalContainerCapa={containerCapaTarget}
            />
          ))}
        </div>
        <div
          ref={setContainerCapaTarget}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[100] overflow-hidden"
        />
      </div>

      {entradaAtiva && (
        <EntradaContainerAlphaLayer
          key={sequenciaEntrada}
          configuracao={entradaInicial}
          slideInicial={slides[0]}
          pausado={pausado}
          onComplete={concluirEntradaApresentacao}
        />
      )}

      <div className="absolute inset-x-0 bottom-0 z-[200] flex h-14 items-center justify-center gap-1.5 border-t border-white/10 bg-gradient-to-t from-slate-950 via-slate-950/95 to-slate-950/80 px-3 text-white backdrop-blur-md sm:px-4">
        <button
          onClick={reiniciarApresentacao}
          disabled={indiceAtual === 0 && !entradaConcluida}
          aria-label="Reiniciar apresentação"
          className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <RotateCcw size={18} aria-hidden="true" />
        </button>
        <button
          onClick={slideAnterior}
          disabled={indiceAtual === 0}
          aria-label="Voltar ao slide anterior"
          className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <button
          onClick={() => setPausado((atual) => !atual)}
          aria-label={pausado ? "Reproduzir apresentação" : "Pausar apresentação"}
          className="rounded-full bg-indigo-600 p-2.5 text-white hover:bg-indigo-500"
        >
          {pausado
            ? <Play size={20} fill="currentColor" aria-hidden="true" />
            : <Pause size={20} fill="currentColor" aria-hidden="true" />}
        </button>
        <button
          onClick={proximoSlide}
          disabled={indiceAtual === slides.length - 1}
          aria-label="Avançar para o próximo slide"
          className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight size={22} aria-hidden="true" />
        </button>
        <label className="ml-2 flex items-center">
          <span className="sr-only">Escolher slide da apresentação</span>
          <input
            type="range"
            min={0}
            max={Math.max(0, slides.length - 1)}
            step={1}
            value={indiceAtual}
            disabled={slides.length <= 1}
            onChange={(event) => navegarPara(Number(event.target.value))}
            aria-label="Navegar pela apresentação"
            aria-valuetext={`Slide ${indiceAtual + 1} de ${slides.length}`}
            className="h-1.5 w-[clamp(90px,28vw,420px)] cursor-pointer accent-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          />
        </label>
        <span className="ml-2 min-w-16 text-center text-xs tabular-nums text-slate-400" aria-live="polite">
          {indiceAtual + 1} / {slides.length}
        </span>
        <button
          onClick={sair}
          aria-label="Fechar apresentação"
          className="absolute right-3 rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
