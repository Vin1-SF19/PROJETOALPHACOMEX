"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import type { FundoAnimadoComponente } from "@/lib/validations/slide-componentes";
import { hexParaRgb, hashStringParaSeed, criarGeradorSeed } from "./fundos-utils";

interface Ancora {
  x: number;
  y: number;
  duracao: number;
  atraso: number;
}

/**
 * Seed fixa (não `Math.random()` puro) — o Container Alpha monta uma prévia deste mesmo
 * componente dentro da porta (`SlidePortalPreview`) simultaneamente ao slide real por
 * baixo; sem seed compartilhada as âncoras "pulam" de lugar quando a prévia dá lugar ao
 * slide real. Ver comentário completo em fundos-utils.ts.
 */
function criarAncoras(quantidade: number, duracaoBase: number, seed: number): Ancora[] {
  const random = criarGeradorSeed(seed);
  return Array.from({ length: quantidade }, () => ({
    x: random() * 100,
    y: random() * 100,
    duracao: duracaoBase + random() * (duracaoBase * 0.4),
    atraso: random() * duracaoBase * 0.6,
  }));
}

/** Adaptado de BlueprintBackground.tsx (Alpha Blueprint) — cor, velocidade, densidade e a grade viram editáveis. */
export function BlueprintFundo({ componente }: { componente: FundoAnimadoComponente }) {
  const reduceMotion = useReducedMotion();
  const accentRgb = hexParaRgb(componente.corPrimaria);
  const accentSecundariaRgb = hexParaRgb(componente.corSecundaria, "14, 165, 233");
  const velocidade = componente.velocidade;
  const duracaoAncoraBase = 14 / velocidade;
  const quantidadeAncoras = Math.max(3, Math.round(10 * componente.densidade));

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const glowX = useSpring(useTransform(pointerX, (v) => v * 0.4), { stiffness: 35, damping: 18, mass: 0.8 });
  const glowY = useSpring(useTransform(pointerY, (v) => v * 0.4), { stiffness: 35, damping: 18, mass: 0.8 });
  const [ancoras, setAncoras] = useState<Ancora[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- posições só podem ser geradas no client (evita hydration mismatch com o SSR), mesmo padrão de BlueprintBackground.tsx original
    setAncoras(criarAncoras(quantidadeAncoras, duracaoAncoraBase, hashStringParaSeed(componente.id)));
  }, [quantidadeAncoras, duracaoAncoraBase, componente.id]);

  useEffect(() => {
    if (reduceMotion || !window.matchMedia("(pointer: fine)").matches) return;

    const atualizar = (e: PointerEvent) => {
      pointerX.set((e.clientX / window.innerWidth - 0.5) * 12);
      pointerY.set((e.clientY / window.innerHeight - 0.5) * 10);
    };
    const resetar = () => {
      pointerX.set(0);
      pointerY.set(0);
    };

    window.addEventListener("pointermove", atualizar, { passive: true });
    window.addEventListener("blur", resetar);
    return () => {
      window.removeEventListener("pointermove", atualizar);
      window.removeEventListener("blur", resetar);
    };
  }, [pointerX, pointerY, reduceMotion]);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #020617 0%, #0a1830 45%, #020617 100%)" }} />

      {componente.mostrarGrade && (
        <>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
              backgroundSize: "120px 120px",
            }}
          />
        </>
      )}

      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(115deg, transparent 42%, rgba(${accentRgb},0.08) 43%, rgba(${accentRgb},0.08) 43.3%, transparent 44%)` }}
      />
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(115deg, transparent 68%, rgba(${accentRgb},0.05) 68.6%, rgba(${accentRgb},0.05) 68.9%, transparent 69.5%)` }}
      />

      {ancoras.map((a, i) => (
        <motion.div
          key={i}
          aria-hidden
          className="absolute rounded-full border"
          style={{ left: `${a.x}%`, top: `${a.y}%`, width: 14, height: 14, borderColor: `rgba(${accentRgb},0.35)` }}
          animate={reduceMotion ? undefined : { opacity: [0.15, 0.35, 0.15] }}
          transition={{ duration: a.duracao, delay: a.atraso, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="absolute inset-[5px] rounded-full" style={{ background: `rgba(${accentRgb},0.4)` }} />
        </motion.div>
      ))}

      <motion.div className="absolute inset-0" style={{ x: glowX, y: glowY }}>
        <motion.div
          animate={reduceMotion ? undefined : { x: [-30, 40, -30], y: [-15, 30, -15] }}
          transition={{ duration: 22 / velocidade, repeat: Infinity, ease: "easeInOut" }}
          className="absolute rounded-full"
          style={{
            width: "50vw", height: "50vh", top: "-12%", left: "-8%",
            background: `radial-gradient(circle, rgba(${accentRgb},0.16) 0%, rgba(${accentRgb},0.05) 40%, transparent 72%)`,
          }}
        />
        <motion.div
          animate={reduceMotion ? undefined : { x: [20, -40, 20], y: [20, -25, 20] }}
          transition={{ duration: 27 / velocidade, repeat: Infinity, ease: "easeInOut" }}
          className="absolute rounded-full"
          style={{
            width: "45vw", height: "45vh", bottom: "-10%", right: "-6%",
            background: `radial-gradient(circle, rgba(${accentSecundariaRgb},0.14) 0%, rgba(${accentSecundariaRgb},0.03) 42%, transparent 72%)`,
          }}
        />
      </motion.div>

      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(circle at 50% 20%, transparent 0%, rgba(2,6,23,0.12) 55%, rgba(2,6,23,0.36) 100%)" }}
      />
    </div>
  );
}
