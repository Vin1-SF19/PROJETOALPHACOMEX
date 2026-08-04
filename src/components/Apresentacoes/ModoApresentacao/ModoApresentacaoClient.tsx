"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Pause, Play, RotateCcw, X } from "lucide-react";
import type { ContainerIntroEvent } from "@/lib/apresentacoes/container-intro";
import {
  converterDimensoesEntrePalcos,
  criarClipInicialAbertura,
  criarClipInicialContainer,
} from "@/lib/apresentacoes/container-intro";
import { calcularEscalaApresentacao } from "@/lib/apresentacoes/viewport";
import { SlideApresentacaoLayer, type SlideApresentacao } from "./SlideApresentacaoLayer";
import { TransicaoContainerAlphaLayer } from "./TransicaoContainerAlphaLayer";
import {
  obterAnimacaoContainerAlphaInicial,
  type ConfigAnimacaoContainerAlpha,
} from "@/lib/apresentacoes/animacao-container-alpha";
import { desbloquearAudioContainer } from "@/lib/apresentacoes/container-carga-audio";

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
  onClose?: () => void;
}

interface IntroEmCurso {
  id: number;
  origemIndex: number;
  destinoIndex: number;
  clipInicial: string;
  duracao: number;
}

interface TransicaoAnimacaoEmCurso {
  id: number;
  origemIndex: number;
  destinoIndex: number;
  configuracao: ConfigAnimacaoContainerAlpha;
}

function criarTransicaoContainerAlphaInicial(
  slides: SlideApresentacao[],
  id: number,
): TransicaoAnimacaoEmCurso | null {
  const configuracao = obterAnimacaoContainerAlphaInicial(slides);
  if (!configuracao) return null;
  return { id, origemIndex: 0, destinoIndex: 0, configuracao };
}

export function ModoApresentacaoClient({
  apresentacaoId,
  slides,
  tema,
  embutido = false,
  onClose,
}: ModoApresentacaoClientProps) {
  const router = useRouter();
  const playerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const indiceAtualRef = useRef(0);
  const introRef = useRef<IntroEmCurso | null>(null);
  const sequenciaIntroRef = useRef(0);
  const transicaoInicial = embutido ? criarTransicaoContainerAlphaInicial(slides, 1) : null;
  const transicaoAnimacaoRef = useRef<TransicaoAnimacaoEmCurso | null>(transicaoInicial);
  const sequenciaTransicaoAnimacaoRef = useRef(transicaoInicial?.id ?? 0);
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [intro, setIntro] = useState<IntroEmCurso | null>(null);
  const [transicaoAnimacao, setTransicaoAnimacao] = useState<TransicaoAnimacaoEmCurso | null>(transicaoInicial);
  const [escalaSlide, setEscalaSlide] = useState(1);
  const [pausado, setPausado] = useState(false);
  const [iniciado, setIniciado] = useState(embutido);
  const [telaCheia, setTelaCheia] = useState(false);
  const [containerCapaTarget, setContainerCapaTarget] = useState<HTMLDivElement | null>(null);
  const pausadoRef = useRef(false);
  const temAberturaInicial = obterAnimacaoContainerAlphaInicial(slides) !== null;
  const slideAtual = slides[indiceAtual];
  const slidePalco = intro
    ? slides[intro.origemIndex]
    : transicaoAnimacao
      ? slides[transicaoAnimacao.origemIndex]
      : slideAtual;

  const navegarPara = useCallback((proximoIndice: number) => {
    const limitado = Math.min(Math.max(proximoIndice, 0), slides.length - 1);
    introRef.current = null;
    setIntro(null);
    transicaoAnimacaoRef.current = null;
    setTransicaoAnimacao(null);
    indiceAtualRef.current = limitado;
    setIndiceAtual(limitado);
  }, [slides.length]);

  const prepararAberturaInicial = useCallback(() => {
    const proximoId = sequenciaTransicaoAnimacaoRef.current + 1;
    const novaTransicao = criarTransicaoContainerAlphaInicial(slides, proximoId);
    if (!novaTransicao) return;
    sequenciaTransicaoAnimacaoRef.current = proximoId;
    transicaoAnimacaoRef.current = novaTransicao;
    setTransicaoAnimacao(novaTransicao);
  }, [slides]);

  const proximoSlide = useCallback(() => {
    const origemIndex = indiceAtualRef.current;
    const destinoIndex = origemIndex + 1;
    if (destinoIndex >= slides.length || introRef.current || transicaoAnimacaoRef.current) return;
    navegarPara(destinoIndex);
  }, [navegarPara, slides]);

  const slideAnterior = useCallback(() => {
    navegarPara(indiceAtualRef.current - 1);
  }, [navegarPara]);

  const reiniciarApresentacao = useCallback(() => {
    navegarPara(0);
    prepararAberturaInicial();
    setPausado(false);
  }, [navegarPara, prepararAberturaInicial]);

  const iniciarZoomTransicaoAnimacao = useCallback(() => {
    const transicaoAtual = transicaoAnimacaoRef.current;
    if (!transicaoAtual) return;
    indiceAtualRef.current = transicaoAtual.destinoIndex;
    setIndiceAtual(transicaoAtual.destinoIndex);
  }, []);

  const concluirTransicaoAnimacao = useCallback(() => {
    const transicaoAtual = transicaoAnimacaoRef.current;
    if (!transicaoAtual) return;
    indiceAtualRef.current = transicaoAtual.destinoIndex;
    setIndiceAtual(transicaoAtual.destinoIndex);
    transicaoAnimacaoRef.current = null;
    setTransicaoAnimacao(null);
  }, []);

  const sair = useCallback(() => {
    if (embutido) {
      onClose?.();
      return;
    }
    router.push(`/PainelAlpha/Apresentacoes/${apresentacaoId}/editor`);
  }, [apresentacaoId, embutido, onClose, router]);

  const alternarTelaCheia = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen?.();
        return;
      }
      await playerRef.current?.requestFullscreen?.();
    } catch {
      // O player continua utilizável no modal quando o navegador negar fullscreen.
    }
  }, []);

  const iniciarApresentacao = useCallback(() => {
    void desbloquearAudioContainer();
    prepararAberturaInicial();
    setIniciado(true);
    playerRef.current?.requestFullscreen?.().catch(() => {
      // A rota standalone continua full-page quando o navegador negar fullscreen.
    });
  }, [prepararAberturaInicial]);

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
      const alvoInterativo = event.target instanceof Element
        && event.target.closest("button, input, select, textarea, a, [role='slider']");
      if (alvoInterativo && event.key !== "Escape") return;
      if (!iniciado) {
        if (event.key === "Escape") sair();
        return;
      }

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
  }, [iniciado, proximoSlide, sair, slideAnterior]);

  useEffect(() => {
    pausadoRef.current = pausado;
    const animations = playerRef.current?.getAnimations({ subtree: true }) ?? [];
    for (const animation of animations) {
      if (pausado) animation.pause();
      else animation.play();
    }
  }, [pausado]);

  useEffect(() => {
    if (!iniciado) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const atualizarEscala = (width: number, height: number) => {
      setEscalaSlide(calcularEscalaApresentacao(width, height, slidePalco.canvas.width, slidePalco.canvas.height));
    };
    atualizarEscala(viewport.clientWidth, viewport.clientHeight);

    const observer = new ResizeObserver(([entry]) => {
      atualizarEscala(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [iniciado, slidePalco.canvas.height, slidePalco.canvas.width]);

  useEffect(() => {
    const atualizarTelaCheia = () => setTelaCheia(document.fullscreenElement === playerRef.current);
    document.addEventListener("fullscreenchange", atualizarTelaCheia);
    return () => document.removeEventListener("fullscreenchange", atualizarTelaCheia);
  }, []);

  if (!slideAtual) return null;

  const camadas = intro
    ? [
        { slide: slides[intro.origemIndex], indice: intro.origemIndex, zIndex: 1, revelar: false },
        { slide: slides[intro.destinoIndex], indice: intro.destinoIndex, zIndex: 2, revelar: true },
      ]
    : [{ slide: slideAtual, indice: indiceAtual, zIndex: 1, revelar: false }];
  return (
    <div
      ref={playerRef}
      onPointerDown={() => {
        void desbloquearAudioContainer();
      }}
      className={`relative flex flex-col overflow-hidden bg-black ${embutido ? "h-full w-full" : "h-dvh w-dvw"}`}
      style={tema ? ({
        "--tema-cor-primaria": tema.corPrimaria,
        "--tema-cor-secundaria": tema.corSecundaria,
        "--tema-cor-accent": tema.corAccent,
      } as React.CSSProperties) : undefined}
    >
      {!iniciado ? (
        <div className="flex min-h-0 flex-1 items-center justify-center bg-gradient-to-br from-slate-950 via-black to-slate-950 p-6">
          <button
            type="button"
            onClick={iniciarApresentacao}
            className="inline-flex min-h-12 items-center justify-center gap-3 rounded-2xl bg-indigo-600 px-7 py-3 text-sm font-semibold text-white shadow-2xl shadow-indigo-950/50 transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <Play size={20} fill="currentColor" aria-hidden="true" />
            Iniciar apresentação
          </button>
        </div>
      ) : (
        <>
      <div
        ref={viewportRef}
        onClick={(event) => {
          if (pausado || (event.target as HTMLElement).closest("button, a, input, textarea, select")) return;
          proximoSlide();
        }}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black"
      >
        <div
          className="relative shrink-0 overflow-hidden bg-slate-900"
          style={{
            width: slidePalco.canvas.width,
            height: slidePalco.canvas.height,
            backgroundColor: slidePalco.canvas.backgroundColor,
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
          {transicaoAnimacao && slides[transicaoAnimacao.destinoIndex] && (
            <TransicaoContainerAlphaLayer
              key={transicaoAnimacao.id}
              configuracao={transicaoAnimacao.configuracao}
              canvasPalco={slidePalco.canvas}
              slideDestino={slides[transicaoAnimacao.destinoIndex]}
              pausado={pausado}
              onZoomStart={iniciarZoomTransicaoAnimacao}
              onComplete={concluirTransicaoAnimacao}
            />
          )}
        </div>
        <div
          ref={setContainerCapaTarget}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[100] overflow-hidden"
        />
      </div>

      <div className="relative z-[200] flex min-h-16 shrink-0 flex-wrap items-center gap-1 border-t border-white/10 bg-slate-950 px-2 py-1 text-white sm:flex-nowrap sm:gap-1.5 sm:px-4">
        <button
          onClick={reiniciarApresentacao}
          disabled={indiceAtual === 0 && !transicaoAnimacao && !temAberturaInicial}
          aria-label="Reiniciar apresentação"
          className="flex size-10 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <RotateCcw size={18} aria-hidden="true" />
        </button>
        <button
          onClick={slideAnterior}
          disabled={indiceAtual === 0}
          aria-label="Voltar ao slide anterior"
          className="flex size-10 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <button
          onClick={() => setPausado((atual) => !atual)}
          aria-label={pausado ? "Reproduzir apresentação" : "Pausar apresentação"}
          className="flex size-10 items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        >
          {pausado
            ? <Play size={20} fill="currentColor" aria-hidden="true" />
            : <Pause size={20} fill="currentColor" aria-hidden="true" />}
        </button>
        <button
          onClick={proximoSlide}
          disabled={indiceAtual === slides.length - 1}
          aria-label="Avançar para o próximo slide"
          className="flex size-10 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight size={22} aria-hidden="true" />
        </button>
        <label className="order-last flex h-4 basis-full items-center px-2 sm:order-none sm:ml-1 sm:min-w-0 sm:flex-1 sm:basis-auto sm:px-0">
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
            className="h-1.5 w-full cursor-pointer accent-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
          />
        </label>
        <span className="ml-auto min-w-14 text-center text-xs tabular-nums text-slate-400 sm:ml-2 sm:min-w-16" aria-live="polite">
          {indiceAtual + 1} / {slides.length}
        </span>
        <button
          onClick={() => void alternarTelaCheia()}
          aria-label={telaCheia ? "Sair da tela cheia" : "Abrir em tela cheia"}
          className="flex size-10 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          {telaCheia
            ? <Minimize2 size={18} aria-hidden="true" />
            : <Maximize2 size={18} aria-hidden="true" />}
        </button>
        <button
          onClick={sair}
          aria-label="Fechar apresentação"
          className="flex size-10 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
        </>
      )}
    </div>
  );
}
