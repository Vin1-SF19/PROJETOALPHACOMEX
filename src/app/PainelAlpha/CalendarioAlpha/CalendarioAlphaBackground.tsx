"use client";

import { useEffect } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";

type StarLayer = "distant" | "medium" | "near";

const STAR_CONFIG: Record<StarLayer, { amount: number; size: number; color: string }> = {
  distant: { amount: 140, size: 1, color: "rgba(226, 232, 240, 0.7)" },
  medium: { amount: 64, size: 1.4, color: "rgba(199, 210, 254, 0.85)" },
  near: { amount: 26, size: 1.9, color: "rgba(255, 255, 255, 0.95)" },
};

function createSeededRandom(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function createStars({ amount, size, color }: (typeof STAR_CONFIG)[StarLayer], seed: number) {
  const random = createSeededRandom(seed);
  return Array.from({ length: amount }, () => {
    const x = Math.floor(random() * 2560);
    const y = Math.floor(random() * 2200);
    const glow = size > 1 ? `, 0 0 ${size * 3.5}px ${color}` : "";
    return `${x}px ${y}px 0 ${color}${glow}`;
  }).join(", ");
}

const STAR_SHADOWS: Record<StarLayer, string> = {
  distant: createStars(STAR_CONFIG.distant, 4409),
  medium: createStars(STAR_CONFIG.medium, 5519),
  near: createStars(STAR_CONFIG.near, 6629),
};

/** 12 marcadores em círculo, como as horas de um relógio — detalhe próprio do Calendário Alpha. */
const MARCADORES_HORA = Array.from({ length: 12 }, (_, i) => (i / 12) * 360);

export default function CalendarioAlphaBackground({ accentRgb }: { accentRgb: string }) {
  const reduceMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const starsX = useSpring(useTransform(pointerX, (value) => value * 0.3), { stiffness: 42, damping: 18, mass: 0.7 });
  const starsY = useSpring(useTransform(pointerY, (value) => value * 0.3), { stiffness: 42, damping: 18, mass: 0.7 });
  const glowX = useSpring(useTransform(pointerX, (value) => value * 0.6), { stiffness: 35, damping: 18, mass: 0.8 });
  const glowY = useSpring(useTransform(pointerY, (value) => value * 0.6), { stiffness: 35, damping: 18, mass: 0.8 });

  useEffect(() => {
    if (reduceMotion || !window.matchMedia("(pointer: fine)").matches) return;

    const updateParallax = (event: PointerEvent) => {
      pointerX.set((event.clientX / window.innerWidth - 0.5) * 16);
      pointerY.set((event.clientY / window.innerHeight - 0.5) * 12);
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
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(150deg, #020617 0%, #0b1730 40%, #071426 66%, #020617 100%)" }}
      />

      <motion.div className="absolute inset-0" style={{ x: starsX, y: starsY }}>
        {(["distant", "medium", "near"] as const).map((layer) => {
          const config = STAR_CONFIG[layer];
          return (
            <motion.div
              key={layer}
              aria-hidden
              className="absolute left-0 top-0 rounded-full"
              style={{
                width: config.size,
                height: config.size,
                boxShadow: STAR_SHADOWS[layer],
                opacity: layer === "distant" ? 0.55 : layer === "medium" ? 0.75 : 0.92,
              }}
              animate={
                reduceMotion
                  ? undefined
                  : {
                      y: layer === "distant" ? [0, -14, 0] : layer === "medium" ? [0, -22, 0] : [0, -30, 0],
                      opacity:
                        layer === "near"
                          ? [0.56, 0.88, 0.56]
                          : layer === "medium"
                            ? [0.6, 0.84, 0.6]
                            : [0.42, 0.64, 0.42],
                    }
              }
              transition={{ duration: layer === "distant" ? 20 : layer === "medium" ? 15 : 11, repeat: Infinity, ease: "easeInOut" }}
            />
          );
        })}
      </motion.div>

      <motion.div className="absolute inset-0" style={{ x: glowX, y: glowY }}>
        <motion.div
          animate={reduceMotion ? undefined : { x: [-30, 50, -30], y: [-16, 40, -16] }}
          transition={{ duration: 23, repeat: Infinity, ease: "easeInOut" }}
          className="absolute"
          style={{
            width: "62vw",
            height: "62vh",
            top: "-14%",
            left: "-10%",
            background: `radial-gradient(circle, rgba(${accentRgb}, 0.15) 0%, rgba(${accentRgb}, 0.05) 40%, transparent 72%)`,
            borderRadius: "50%",
          }}
        />
        <motion.div
          animate={reduceMotion ? undefined : { x: [24, -48, 24], y: [22, -34, 22] }}
          transition={{ duration: 29, repeat: Infinity, ease: "easeInOut" }}
          className="absolute"
          style={{
            width: "52vw",
            height: "52vh",
            bottom: "-10%",
            right: "-8%",
            background: `radial-gradient(circle, rgba(245, 158, 11, 0.09) 0%, rgba(${accentRgb}, 0.035) 46%, transparent 74%)`,
            borderRadius: "50%",
          }}
        />
      </motion.div>

      {/* Mostrador de relógio — detalhe exclusivo do Calendário Alpha (12 marcadores de hora + ponteiro varrendo) */}
      <div className="absolute left-1/2 top-[20%] h-[30rem] w-[30rem] -translate-x-1/2">
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-full border border-white/[0.04]"
          animate={reduceMotion ? undefined : { scale: [1, 1.03, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
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
          style={{ background: `linear-gradient(to bottom, rgba(${accentRgb}, 0.5), transparent)` }}
          animate={reduceMotion ? undefined : { rotate: 360 }}
          transition={{ duration: 48, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <motion.div
        aria-hidden
        className="absolute right-[10%] top-[26%] h-28 w-28 rounded-full border border-amber-300/[0.06]"
        animate={reduceMotion ? undefined : { scale: [0.9, 1.1, 0.9], opacity: [0.16, 0.38, 0.16] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />

      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(circle at 50% 18%, transparent 0%, rgba(2, 6, 23, 0.12) 52%, rgba(2, 6, 23, 0.42) 100%)" }}
      />
    </div>
  );
}
