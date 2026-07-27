"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";

interface Ancora {
  x: number;
  y: number;
  duracao: number;
  atraso: number;
}

function criarAncoras(quantidade: number): Ancora[] {
  return Array.from({ length: quantidade }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    duracao: 14 + Math.random() * 6,
    atraso: Math.random() * 8,
  }));
}

/**
 * Background dedicado do Alpha Blueprint — variação temática do padrão "fundo vivo por
 * módulo" (ver ChecklistBackground.tsx). Mood "mesa de desenho técnico": grade de papel
 * milimetrado estática + âncoras (cotas de medição) pulsando + linhas de régua diagonal +
 * glows accent contidos. Aplicado SOMENTE no layout do módulo, fora da área do Canvas em si
 * (decisão do usuário — Canvas mantém fundo sólido para não competir com os elementos).
 */
export function BlueprintBackground({ accentRgb }: { accentRgb: string }) {
  const reduceMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const glowX = useSpring(useTransform(pointerX, (v) => v * 0.4), { stiffness: 35, damping: 18, mass: 0.8 });
  const glowY = useSpring(useTransform(pointerY, (v) => v * 0.4), { stiffness: 35, damping: 18, mass: 0.8 });
  const [ancoras, setAncoras] = useState<Ancora[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- posições aleatórias só podem ser geradas no client (evita hydration mismatch com o SSR), mesmo padrão de createStars() em ChecklistBackground.tsx
    setAncoras(criarAncoras(10));
  }, []);

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
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(135deg, #020617 0%, #0a1830 45%, #020617 100%)" }}
      />

      {/* Grade de papel milimetrado — fina + grossa, estática (elemento de "estrutura") */}
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

      {/* Linhas de régua diagonal — assinatura visual do módulo */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(115deg, transparent 42%, rgba(${accentRgb},0.08) 43%, rgba(${accentRgb},0.08) 43.3%, transparent 44%)`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(115deg, transparent 68%, rgba(${accentRgb},0.05) 68.6%, rgba(${accentRgb},0.05) 68.9%, transparent 69.5%)`,
        }}
      />

      {/* Âncoras — cotas de medição pulsando, dessincronizadas */}
      {ancoras.map((a, i) => (
        <motion.div
          key={i}
          aria-hidden
          className="absolute rounded-full border"
          style={{
            left: `${a.x}%`,
            top: `${a.y}%`,
            width: 14,
            height: 14,
            borderColor: `rgba(${accentRgb},0.35)`,
          }}
          animate={reduceMotion ? undefined : { opacity: [0.15, 0.35, 0.15] }}
          transition={{ duration: a.duracao, delay: a.atraso, repeat: Infinity, ease: "easeInOut" }}
        >
          <span
            className="absolute inset-[5px] rounded-full"
            style={{ background: `rgba(${accentRgb},0.4)` }}
          />
        </motion.div>
      ))}

      {/* Luz de mesa de trabalho — glows accent contidos (menores que o padrão CheckList) */}
      <motion.div className="absolute inset-0" style={{ x: glowX, y: glowY }}>
        <motion.div
          animate={reduceMotion ? undefined : { x: [-30, 40, -30], y: [-15, 30, -15] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          className="absolute rounded-full"
          style={{
            width: "50vw",
            height: "50vh",
            top: "-12%",
            left: "-8%",
            background: `radial-gradient(circle, rgba(${accentRgb},0.16) 0%, rgba(${accentRgb},0.05) 40%, transparent 72%)`,
          }}
        />
        <motion.div
          animate={reduceMotion ? undefined : { x: [20, -40, 20], y: [20, -25, 20] }}
          transition={{ duration: 27, repeat: Infinity, ease: "easeInOut" }}
          className="absolute rounded-full"
          style={{
            width: "45vw",
            height: "45vh",
            bottom: "-10%",
            right: "-6%",
            background: `radial-gradient(circle, rgba(${accentRgb},0.12) 0%, rgba(${accentRgb},0.03) 42%, transparent 72%)`,
          }}
        />
      </motion.div>

      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(circle at 50% 20%, transparent 0%, rgba(2,6,23,0.12) 55%, rgba(2,6,23,0.36) 100%)",
        }}
      />
    </div>
  );
}
