import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Maximize2, Minimize2, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { RenderComponente } from "@/components/Apresentacoes/Editor/RenderEngine/RenderComponente";
import { ScrollRevealWrapper } from "@/components/Apresentacoes/Editor/RenderEngine/ScrollRevealWrapper";
import { stylePosicaoAbsoluta } from "@/components/Apresentacoes/Editor/RenderEngine/posicionamento";
import { calcularEscalaApresentacao } from "@/lib/apresentacoes/viewport";
import { TransicaoSlide } from "@/components/Apresentacoes/ModoApresentacao/TransicaoSlide";
import { TransicaoContainerAlphaLayer } from "@/components/Apresentacoes/ModoApresentacao/TransicaoContainerAlphaLayer";
import { obterAnimacaoContainerAlphaInicial } from "@/lib/apresentacoes/animacao-container-alpha";
import { desbloquearAudioContainer } from "@/lib/apresentacoes/container-carga-audio";
import { resolverAnimacoesDoElemento } from "@/lib/apresentacoes/animacao/resolver";
import type { DadosApresentacaoExportada } from "./dados-tipos";

/**
 * Tempo de bloqueio após cada avanço — cobre a duração real da transição (`TransicaoSlide`
 * usa 0.4s de saída + 0.4s de entrada, `AnimatePresence mode="wait"`) para garantir que 1
 * gesto de scroll (que dispara dezenas de eventos `wheel` em sequência num trackpad) resulte
 * em exatamente 1 avanço, nunca vários.
 */
const COOLDOWN_NAVEGACAO_MS = 800;
/** `deltaY` mínimo pra considerar um evento de wheel como intenção real de rolar (ignora ruído). */
const LIMIAR_WHEEL_DELTA = 12;

type EstadoCapa = "fechada" | "abrindo" | "concluida";

/**
 * Shell do player standalone. 1 clique ou 1 tick de scroll avança exatamente 1 slide, com a
 * transição configurada naquele slide (`TransicaoSlide.tsx`, reaproveitado sem alteração —
 * hoje órfão no player ao vivo, mas funcional e é exatamente o efeito que faltava aqui).
 *
 * Se o slide 1 tiver a animação de entrada "Container Alpha" configurada, ele aparece
 * FECHADO ao montar (`TransicaoContainerAlphaLayer` com `deverIniciar={false}`) — o primeiro
 * gesto do usuário destrava (`deverIniciar={true}`), disparando a sequência real (porta abre,
 * câmera avança). Só depois disso o deck normal (com navegação) assume o controle.
 *
 * Fase 08 acrescentou: navegação reversa (`voltar`), reinício (`reiniciar`), tela cheia
 * (`alternarTelaCheia`, mesmo padrão de `ModoApresentacaoClient.tsx`), atalhos de teclado
 * (seta esquerda/direita, espaço, F) e Scroll Reveal por componente (`ScrollRevealWrapper`,
 * ativo só quando o elemento tem uma `ElementAnimation` com `trigger: "on-scroll"`).
 */
export function PlayerStandalone({ dados }: { dados: DadosApresentacaoExportada }) {
  const configCapaInicial = useMemo(() => obterAnimacaoContainerAlphaInicial(dados.slides), [dados.slides]);
  const [estadoCapa, setEstadoCapa] = useState<EstadoCapa>(configCapaInicial ? "fechada" : "concluida");
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [jaInteragiu, setJaInteragiu] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);
  const bloqueadoRef = useRef(false);
  const indiceRef = useRef(0);
  useEffect(() => {
    indiceRef.current = indiceAtual;
  }, [indiceAtual]);

  const [telaCheia, setTelaCheia] = useState(false);
  const slideAtual = dados.slides[indiceAtual];
  const capaAtiva = estadoCapa !== "concluida";

  const avancar = useCallback(() => {
    if (bloqueadoRef.current) return;
    const proximo = indiceRef.current + 1;
    if (proximo >= dados.slides.length) return;
    bloqueadoRef.current = true;
    setJaInteragiu(true);
    setIndiceAtual(proximo);
    setTimeout(() => {
      bloqueadoRef.current = false;
    }, COOLDOWN_NAVEGACAO_MS);
  }, [dados.slides.length]);

  /** Espelha `avancar` (mesmo cooldown/bloqueio) — Fase 08, navegação por teclado/botão. */
  const voltar = useCallback(() => {
    if (bloqueadoRef.current || capaAtiva) return;
    const anterior = indiceRef.current - 1;
    if (anterior < 0) return;
    bloqueadoRef.current = true;
    setJaInteragiu(true);
    setIndiceAtual(anterior);
    setTimeout(() => {
      bloqueadoRef.current = false;
    }, COOLDOWN_NAVEGACAO_MS);
  }, [capaAtiva]);

  const reiniciar = useCallback(() => {
    bloqueadoRef.current = false;
    setIndiceAtual(0);
    setJaInteragiu(false);
    if (configCapaInicial) setEstadoCapa("fechada");
  }, [configCapaInicial]);

  /** Mesmo padrão de `ModoApresentacaoClient.tsx` — melhor esforço, nunca crítica se o navegador negar. */
  const alternarTelaCheia = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen?.();
        return;
      }
      await viewportRef.current?.requestFullscreen?.();
    } catch {
      // O player continua utilizável fora da tela cheia quando o navegador negar.
    }
  }, []);

  const destravarCapa = useCallback(() => {
    if (estadoCapa !== "fechada") return;
    void desbloquearAudioContainer();
    setJaInteragiu(true);
    setEstadoCapa("abrindo");
  }, [estadoCapa]);

  const handleGesto = useCallback(() => {
    if (capaAtiva) {
      destravarCapa();
      return;
    }
    avancar();
  }, [capaAtiva, destravarCapa, avancar]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !slideAtual) return;

    const atualizarEscala = (largura: number, altura: number) => {
      setEscala(calcularEscalaApresentacao(largura, altura, slideAtual.canvas.width, slideAtual.canvas.height));
    };
    atualizarEscala(viewport.clientWidth, viewport.clientHeight);

    const resizeObserver = new ResizeObserver(([entrada]) => {
      atualizarEscala(entrada.contentRect.width, entrada.contentRect.height);
    });
    resizeObserver.observe(viewport);
    return () => resizeObserver.disconnect();
  }, [slideAtual]);

  useEffect(() => {
    function handleWheel(event: WheelEvent) {
      if (Math.abs(event.deltaY) < LIMIAR_WHEEL_DELTA) return;
      event.preventDefault();
      handleGesto();
    }
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [handleGesto]);

  useEffect(() => {
    const atualizarTelaCheia = () => setTelaCheia(document.fullscreenElement === viewportRef.current);
    document.addEventListener("fullscreenchange", atualizarTelaCheia);
    return () => document.removeEventListener("fullscreenchange", atualizarTelaCheia);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const alvoInterativo = event.target instanceof Element
        && event.target.closest("button, input, select, textarea, a, [role='slider']");
      if (alvoInterativo) return;

      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        handleGesto();
      } else if (event.key === "ArrowLeft") {
        voltar();
      } else if (event.key === "f" || event.key === "F") {
        void alternarTelaCheia();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleGesto, voltar, alternarTelaCheia]);

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const alvo = event.target as HTMLElement;
    if (alvo.closest("button, a, input, textarea, select")) return;
    handleGesto();
  }

  if (!slideAtual) {
    return (
      <div className="flex h-dvh w-dvw items-center justify-center bg-black text-sm text-slate-400">
        Esta apresentação não tem slides.
      </div>
    );
  }

  return (
    <div
      ref={viewportRef}
      onClick={handleClick}
      className="relative flex h-dvh w-dvw items-center justify-center overflow-hidden bg-black"
    >
      {capaAtiva && configCapaInicial ? (
        <TransicaoContainerAlphaLayer
          configuracao={configCapaInicial}
          slideDestino={{ componentes: slideAtual.componentes, canvas: slideAtual.canvas }}
          pausado={false}
          deverIniciar={estadoCapa === "abrindo"}
          onComplete={() => setEstadoCapa("concluida")}
        />
      ) : (
        <TransicaoSlide slideId={slideAtual.id} transicaoEntrada={slideAtual.transicaoEntrada}>
          <div className="flex h-full w-full items-center justify-center">
            <div
              className="relative shrink-0 overflow-hidden"
              style={{
                width: slideAtual.canvas.width,
                height: slideAtual.canvas.height,
                backgroundColor: slideAtual.canvas.backgroundColor,
                backgroundImage: slideAtual.canvas.backgroundImage,
                transform: `scale(${escala})`,
                transformOrigin: "center center",
              }}
            >
              {slideAtual.componentes.map((componente) => (
                <div key={componente.id} style={stylePosicaoAbsoluta(componente)}>
                  <ScrollRevealWrapper animacoes={resolverAnimacoesDoElemento(componente, slideAtual.animacaoConfig ?? undefined).map((r) => r.animacao)}>
                    <RenderComponente componente={componente} modo="apresentacao" />
                  </ScrollRevealWrapper>
                </div>
              ))}
            </div>
          </div>
        </TransicaoSlide>
      )}

      {!jaInteragiu && indiceAtual === 0 && (dados.slides.length > 1 || capaAtiva) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 z-[200] flex justify-center">
          <span className="animate-bounce text-xs font-medium text-white/60">role pra continuar ↓</span>
        </div>
      )}

      {jaInteragiu && !capaAtiva && (
        <div className="absolute inset-x-0 bottom-4 z-[200] flex justify-center">
          <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-slate-950/80 px-2 py-1.5 text-white backdrop-blur-xl">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); reiniciar(); }}
              aria-label="Reiniciar apresentação"
              className="flex size-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <RotateCcw size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); voltar(); }}
              disabled={indiceAtual === 0}
              aria-label="Voltar ao slide anterior"
              className="flex size-9 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <span className="min-w-14 text-center text-xs tabular-nums text-slate-400" aria-live="polite">
              {indiceAtual + 1} / {dados.slides.length}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); avancar(); }}
              disabled={indiceAtual === dados.slides.length - 1}
              aria-label="Avançar para o próximo slide"
              className="flex size-9 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); void alternarTelaCheia(); }}
              aria-label={telaCheia ? "Sair da tela cheia" : "Abrir em tela cheia"}
              className="flex size-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              {telaCheia ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
