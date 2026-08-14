"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { FundoAnimadoComponente } from "@/lib/validations/slide-componentes";
import { hexParaRgb, hashStringParaSeed, criarGeradorSeed } from "./fundos-utils";
import { useVisibilidadeIframe } from "./useVisibilidadeIframe";

type Blip = { x: number; y: number; size: number; delay: number; duration: number };

const ANEIS_BASE = [18, 32, 46, 60, 74];

/**
 * Seed fixa (não `Math.random()` puro) — o Container Alpha monta uma prévia deste mesmo
 * componente dentro da porta (`SlidePortalPreview`) simultaneamente ao slide real por
 * baixo; sem seed compartilhada os blips "pulam" de lugar quando a prévia dá lugar ao
 * slide real. Ver comentário completo em fundos-utils.ts.
 */
function criarBlips(quantidade: number, duracaoBase: number, seed: number): Blip[] {
  const random = criarGeradorSeed(seed);
  return Array.from({ length: quantidade }, () => ({
    x: random() * 100,
    y: random() * 100,
    size: 2 + random() * 2.5,
    delay: random() * duracaoBase * 2.4,
    duration: duracaoBase + random() * duracaoBase,
  }));
}

/** Adaptado de RadarBackground.tsx (Consulta RADAR) — cor, velocidade, densidade e direção viram props editáveis no Presentation Studio. */
export function RadarFundo({ componente }: { componente: FundoAnimadoComponente }) {
  const { ref, visivel } = useVisibilidadeIframe<HTMLDivElement>();
  const reduceMotion = useReducedMotion();
  const accentRgb = hexParaRgb(componente.corPrimaria);
  const velocidade = componente.velocidade;
  const densidade = componente.densidade;
  const aneis = ANEIS_BASE.slice(0, Math.max(2, Math.round(ANEIS_BASE.length * densidade)));
  const duracaoBlipBase = 2.5 / velocidade;
  const quantidadeBlips = Math.max(4, Math.round(16 * densidade));

  const [blips, setBlips] = useState<Blip[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- posições só podem ser geradas no client (evita hydration mismatch com o SSR), mesmo padrão de RadarBackground.tsx original
    setBlips(criarBlips(quantidadeBlips, duracaoBlipBase, hashStringParaSeed(componente.id)));
  }, [quantidadeBlips, duracaoBlipBase, componente.id]);

  return (
    <div ref={ref} className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(135deg, #020617 0%, #0a2146 45%, #020617 100%)" }}
      />

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden>
        {aneis.map((tamanho, i) => (
          <div
            key={tamanho}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: `${tamanho}vmax`,
              height: `${tamanho}vmax`,
              border: `1px solid rgba(${accentRgb}, ${0.12 - i * 0.012})`,
            }}
          />
        ))}
      </div>

      {/* Conteúdo animado só monta com o módulo realmente visível — evita animações
          `repeat: Infinity` rodando em segundo plano com a aba escondida (mas montada). */}
      {visivel && (
      <>
      {!reduceMotion && (
        <motion.div
          className="absolute inset-0"
          style={{ background: `conic-gradient(from 0deg, transparent, rgba(${accentRgb}, 0.22), transparent 18%)` }}
          animate={{ rotate: componente.direcao === "antihorario" ? -360 : 360 }}
          transition={{ duration: 6 / velocidade, repeat: Infinity, ease: "linear" }}
        />
      )}

      {blips.map((blip, i) => (
        <motion.div
          key={i}
          aria-hidden
          className="absolute rounded-full"
          style={{
            left: `${blip.x}%`,
            top: `${blip.y}%`,
            width: blip.size,
            height: blip.size,
            background: `rgb(${accentRgb})`,
            boxShadow: `0 0 ${blip.size * 3}px rgba(${accentRgb}, 0.8)`,
          }}
          animate={reduceMotion ? undefined : { opacity: [0, 1, 0] }}
          transition={{ duration: blip.duration, delay: blip.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      </>
      )}

      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(circle at 50% 20%, transparent 0%, rgba(2, 6, 23, 0.1) 55%, rgba(2, 6, 23, 0.34) 100%)" }}
      />
    </div>
  );
}
