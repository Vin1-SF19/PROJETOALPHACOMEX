"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import {
  filtrarPassosTutorialDisponiveis,
  type ConfigTutorialModulo,
  type PassoTutorialModulo,
} from "@/lib/guias/tutorial-modulo";

interface GuiaModuloTourProps {
  aberto: boolean;
  config: ConfigTutorialModulo;
  accent: string;
  onFinalizar: () => void;
}

interface PosicaoTooltip {
  left: number;
  top: number;
  width: number;
}

const MARGEM_SPOTLIGHT = 7;
const MARGEM_VIEWPORT = 12;
const ALTURA_TOOLTIP_ESTIMADA = 230;

function medirAlvo(passo: PassoTutorialModulo): DOMRect | null {
  const elemento = document.querySelector(passo.seletor);
  return elemento instanceof HTMLElement ? elemento.getBoundingClientRect() : null;
}

function calcularTooltip(rect: DOMRect | null): PosicaoTooltip {
  const width = Math.min(360, window.innerWidth - MARGEM_VIEWPORT * 2);
  if (!rect) {
    return {
      left: Math.max(MARGEM_VIEWPORT, (window.innerWidth - width) / 2),
      top: Math.max(MARGEM_VIEWPORT, (window.innerHeight - ALTURA_TOOLTIP_ESTIMADA) / 2),
      width,
    };
  }

  const left = Math.min(
    Math.max(MARGEM_VIEWPORT, rect.left),
    window.innerWidth - width - MARGEM_VIEWPORT,
  );
  const cabeAbaixo = rect.bottom + 14 + ALTURA_TOOLTIP_ESTIMADA <= window.innerHeight;
  const topDesejado = cabeAbaixo
    ? rect.bottom + 14
    : rect.top - ALTURA_TOOLTIP_ESTIMADA - 14;
  const top = Math.min(
    Math.max(MARGEM_VIEWPORT, topDesejado),
    Math.max(MARGEM_VIEWPORT, window.innerHeight - ALTURA_TOOLTIP_ESTIMADA - MARGEM_VIEWPORT),
  );
  return { left, top, width };
}

export function GuiaModuloTour({ aberto, config, accent, onFinalizar }: GuiaModuloTourProps) {
  const [passos, setPassos] = useState<PassoTutorialModulo[]>([]);
  const [indice, setIndice] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const reducedMotion = useReducedMotion();
  const primeiroBotaoRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const frame = window.requestAnimationFrame(() => {
      const disponiveis = filtrarPassosTutorialDisponiveis(config.passos, document);
      setPassos(disponiveis);
      setIndice(0);
      if (disponiveis.length === 0) onFinalizar();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [aberto, config.passos, onFinalizar]);

  const passoAtual = passos[indice] ?? null;

  useEffect(() => {
    if (!aberto || !passoAtual) return;
    const elemento = document.querySelector(passoAtual.seletor);
    if (elemento instanceof HTMLElement) {
      const atual = elemento.getBoundingClientRect();
      if (atual.top < MARGEM_VIEWPORT || atual.bottom > window.innerHeight - MARGEM_VIEWPORT) {
        elemento.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
      }
    }

    const atualizar = () => setRect(medirAlvo(passoAtual));
    atualizar();
    const timer = window.setTimeout(atualizar, reducedMotion ? 0 : 260);
    window.addEventListener("resize", atualizar);
    window.addEventListener("scroll", atualizar, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", atualizar);
      window.removeEventListener("scroll", atualizar, true);
    };
  }, [aberto, passoAtual, reducedMotion]);

  useEffect(() => {
    if (!aberto) return;
    const fecharComEscape = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") onFinalizar();
    };
    document.addEventListener("keydown", fecharComEscape);
    const timer = window.setTimeout(() => primeiroBotaoRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", fecharComEscape);
    };
  }, [aberto, onFinalizar]);

  const tooltip = useMemo(() => {
    if (typeof window === "undefined") return { left: 12, top: 12, width: 320 };
    return calcularTooltip(rect);
  }, [rect]);

  if (!aberto || !passoAtual) return null;

  const ultimoPasso = indice === passos.length - 1;
  const margem = MARGEM_SPOTLIGHT;
  const esquerda = rect ? Math.min(window.innerWidth, Math.max(0, rect.left - margem)) : 0;
  const topo = rect ? Math.min(window.innerHeight, Math.max(0, rect.top - margem)) : 0;
  const direita = rect ? Math.min(window.innerWidth, Math.max(0, rect.right + margem)) : 0;
  const fundo = rect ? Math.min(window.innerHeight, Math.max(0, rect.bottom + margem)) : 0;

  return (
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
      aria-label={`${config.titulo}: ${passoAtual.titulo}`}
    >
      {rect ? (
        <>
          <div className="absolute inset-x-0 top-0 bg-black/75" style={{ height: topo }} />
          <div className="absolute left-0 bg-black/75" style={{ top: topo, width: esquerda, height: fundo - topo }} />
          <div className="absolute right-0 bg-black/75" style={{ top: topo, width: window.innerWidth - direita, height: fundo - topo }} />
          <div className="absolute inset-x-0 bottom-0 bg-black/75" style={{ top: fundo }} />
          <motion.div
            className="absolute pointer-events-none rounded-2xl border-2"
            style={{
              left: esquerda,
              top: topo,
              width: direita - esquerda,
              height: fundo - topo,
              borderColor: `rgba(${accent},0.9)`,
              boxShadow: `0 0 30px rgba(${accent},0.28)`,
            }}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/75" />
      )}

      <AnimatePresence mode="wait">
        <motion.section
          key={passoAtual.id}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
          transition={{ duration: reducedMotion ? 0 : 0.18 }}
          className="absolute rounded-2xl border border-white/10 bg-slate-950/95 p-5 text-slate-200 shadow-2xl backdrop-blur-xl"
          style={tooltip}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: `rgb(${accent})` }}>
                {config.titulo}
              </p>
              <h2 className="mt-1 text-base font-black text-white">{passoAtual.titulo}</h2>
            </div>
            <button
              ref={primeiroBotaoRef}
              type="button"
              onClick={onFinalizar}
              aria-label="Pular tutorial"
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <X size={16} />
            </button>
          </div>

          <p className="mt-2 text-sm leading-relaxed text-slate-400">{passoAtual.descricao}</p>

          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5" aria-label={`Passo ${indice + 1} de ${passos.length}`}>
              {passos.map((passo, passoIndice) => (
                <span
                  key={passo.id}
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: passoIndice === indice ? `rgb(${accent})` : "rgba(255,255,255,0.16)" }}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onFinalizar}
                className="rounded-lg px-2 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                Pular
              </button>
              {indice > 0 && (
                <button
                  type="button"
                  onClick={() => setIndice((atual) => Math.max(0, atual - 1))}
                  className="rounded-lg px-2 py-1.5 text-xs font-bold text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                >
                  Voltar
                </button>
              )}
              <button
                type="button"
                onClick={() => (ultimoPasso ? onFinalizar() : setIndice((atual) => atual + 1))}
                className="rounded-xl px-3.5 py-2 text-xs font-black text-black transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                style={{ background: `rgb(${accent})` }}
              >
                {ultimoPasso ? "Concluir" : "Avançar"}
              </button>
            </div>
          </div>
        </motion.section>
      </AnimatePresence>
    </div>
  );
}
