"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import type { FundoAnimadoComponente } from "@/lib/validations/slide-componentes";
import { hexParaRgb, hashStringParaSeed, criarGeradorSeed } from "./fundos-utils";
import { useVisibilidadeIframe } from "./useVisibilidadeIframe";

type StarLayer = "distant" | "medium" | "near";

const STAR_BASE: Record<StarLayer, { amount: number; size: number; color: string }> = {
  distant: { amount: 155, size: 1, color: "rgba(226, 232, 240, 0.78)" },
  medium: { amount: 76, size: 1.45, color: "rgba(199, 210, 254, 0.88)" },
  near: { amount: 31, size: 2, color: "rgba(255, 255, 255, 0.96)" },
};

/** 12 marcadores em círculo, como as horas de um relógio — herdado do CalendarioAlphaBackground.tsx original. */
const MARCADORES_HORA = Array.from({ length: 12 }, (_, i) => (i / 12) * 360);

/**
 * Seed fixa (não `Math.random()` puro) — o Container Alpha monta uma prévia deste mesmo
 * componente dentro da porta (`SlidePortalPreview`) simultaneamente ao slide real por
 * baixo; sem seed compartilhada as estrelas "pulam" de lugar quando a prévia dá lugar ao
 * slide real. Ver comentário completo em fundos-utils.ts.
 */
function criarStars(amount: number, size: number, color: string, seed: number): string {
  const random = criarGeradorSeed(seed);
  return Array.from({ length: amount }, () => {
    const x = Math.floor(random() * 2560);
    const y = Math.floor(random() * 2200);
    const glow = size > 1 ? `, 0 0 ${size * 3.2}px ${color}` : "";
    return `${x}px ${y}px 0 ${color}${glow}`;
  }).join(", ");
}

/**
 * Engine compartilhada "Estelar" — extraída de CsNpsBackground.tsx/ChecklistBackground.tsx/
 * CalendarioAlphaBackground.tsx (as 3 são a mesma engine, só variando contagem/cor/relógio).
 * Os 3 itens da paleta ("Estelar CS & NPS"/"CheckList"/"Agenda Alpha") só diferem no PRESET
 * inicial (ver registry-fundos.ts) — depois de adicionado, tudo aqui é editável livremente.
 */
export function EstelarFundo({ componente }: { componente: FundoAnimadoComponente }) {
  const { ref, visivel } = useVisibilidadeIframe<HTMLDivElement>();
  const reduceMotion = useReducedMotion();
  const corGlow1 = hexParaRgb(componente.corPrimaria);
  const corGlow2 = hexParaRgb(componente.corSecundaria, "14, 165, 233");
  const velocidade = componente.velocidade;
  const densidade = componente.densidade;

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const starsX = useSpring(useTransform(pointerX, (v) => v * 0.32), { stiffness: 42, damping: 18, mass: 0.7 });
  const starsY = useSpring(useTransform(pointerY, (v) => v * 0.32), { stiffness: 42, damping: 18, mass: 0.7 });
  const glowX = useSpring(useTransform(pointerX, (v) => v * 0.65), { stiffness: 35, damping: 18, mass: 0.8 });
  const glowY = useSpring(useTransform(pointerY, (v) => v * 0.65), { stiffness: 35, damping: 18, mass: 0.8 });

  const [stars, setStars] = useState<Record<StarLayer, string>>({ distant: "", medium: "", near: "" });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- posições só podem ser geradas no client (evita hydration mismatch com o SSR), mesmo padrão de ChecklistBackground.tsx original
    setStars({
      distant: criarStars(Math.round(STAR_BASE.distant.amount * densidade), STAR_BASE.distant.size, STAR_BASE.distant.color, hashStringParaSeed(`${componente.id}-distant`)),
      medium: criarStars(Math.round(STAR_BASE.medium.amount * densidade), STAR_BASE.medium.size, STAR_BASE.medium.color, hashStringParaSeed(`${componente.id}-medium`)),
      near: criarStars(Math.round(STAR_BASE.near.amount * densidade), STAR_BASE.near.size, STAR_BASE.near.color, hashStringParaSeed(`${componente.id}-near`)),
    });
  }, [densidade, componente.id]);

  useEffect(() => {
    if (reduceMotion || !window.matchMedia("(pointer: fine)").matches) return;

    const updateParallax = (event: PointerEvent) => {
      pointerX.set((event.clientX / window.innerWidth - 0.5) * 17);
      pointerY.set((event.clientY / window.innerHeight - 0.5) * 13);
    };
    const resetParallax = () => {
      pointerX.set(0);
      pointerY.set(0);
    };

    window.addEventListener("pointermove", updateParallax, { passive: true });
    window.addEventListener("blur", resetParallax);
    return () => {
      window.removeEventListener("pointermove", updateParallax);
      window.removeEventListener("blur", resetParallax);
    };
  }, [pointerX, pointerY, reduceMotion]);

  return (
    <div ref={ref} className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #020617 0%, #0a2146 45%, #020617 100%)" }} />

      {/* Conteúdo animado só monta com o módulo realmente visível — evita animações
          `repeat: Infinity` rodando em segundo plano com a aba escondida (mas montada). */}
      {visivel && (
      <>
      <motion.div className="absolute inset-0" style={{ x: starsX, y: starsY }}>
        {(["distant", "medium", "near"] as const).map((layer) => {
          const config = STAR_BASE[layer];
          const duracaoBase = layer === "distant" ? 18 : layer === "medium" ? 13 : 9;
          return (
            <motion.div
              key={layer}
              aria-hidden
              className="absolute left-0 top-0 rounded-full"
              style={{
                width: config.size,
                height: config.size,
                boxShadow: stars[layer],
                opacity: layer === "distant" ? 0.6 : layer === "medium" ? 0.8 : 0.96,
              }}
              animate={
                reduceMotion
                  ? undefined
                  : {
                      y: layer === "distant" ? [0, -16, 0] : layer === "medium" ? [0, -25, 0] : [0, -34, 0],
                      opacity:
                        layer === "near"
                          ? [0.6, 0.9, 0.6]
                          : layer === "medium"
                            ? [0.64, 0.86, 0.64]
                            : [0.46, 0.68, 0.46],
                    }
              }
              transition={{ duration: duracaoBase / velocidade, repeat: Infinity, ease: "easeInOut" }}
            />
          );
        })}
      </motion.div>

      <motion.div className="absolute inset-0" style={{ x: glowX, y: glowY }}>
        <motion.div
          animate={reduceMotion ? undefined : { x: [-34, 56, -34], y: [-18, 44, -18] }}
          transition={{ duration: 21 / velocidade, repeat: Infinity, ease: "easeInOut" }}
          className="absolute rounded-full"
          style={{
            width: "68vw", height: "68vh", top: "-16%", left: "-12%",
            background: `radial-gradient(circle, rgba(${corGlow1}, 0.17) 0%, rgba(${corGlow1}, 0.055) 38%, transparent 72%)`,
          }}
        />
        <motion.div
          animate={reduceMotion ? undefined : { x: [26, -54, 26], y: [24, -38, 24] }}
          transition={{ duration: 27 / velocidade, repeat: Infinity, ease: "easeInOut" }}
          className="absolute rounded-full"
          style={{
            width: "56vw", height: "56vh", bottom: "-11%", right: "-9%",
            background: `radial-gradient(circle, rgba(${corGlow2}, 0.13) 0%, rgba(${corGlow2}, 0.04) 44%, transparent 74%)`,
          }}
        />
      </motion.div>

      {componente.mostrarRelogio && (
        <div className="absolute left-1/2 top-[20%] h-[30rem] w-[30rem] -translate-x-1/2">
          <motion.div
            aria-hidden
            className="absolute inset-0 rounded-full border border-white/[0.04]"
            animate={reduceMotion ? undefined : { scale: [1, 1.03, 1] }}
            transition={{ duration: 12 / velocidade, repeat: Infinity, ease: "easeInOut" }}
          />
          {MARCADORES_HORA.map((angulo) => (
            <span
              key={angulo}
              aria-hidden
              className="absolute left-1/2 top-1/2 h-1 w-1 rounded-full bg-white/10"
              style={{ transform: `rotate(${angulo}deg) translateY(-14.9rem)` }}
            />
          ))}
          <motion.div
            aria-hidden
            className="absolute left-1/2 top-1/2 h-[14.9rem] w-px origin-top"
            style={{ background: `linear-gradient(to bottom, rgba(${corGlow1}, 0.5), transparent)` }}
            animate={reduceMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 48 / velocidade, repeat: Infinity, ease: "linear" }}
          />
        </div>
      )}
      </>
      )}

      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(circle at 50% 20%, transparent 0%, rgba(2, 6, 23, 0.1) 55%, rgba(2, 6, 23, 0.34) 100%)" }}
      />
    </div>
  );
}
