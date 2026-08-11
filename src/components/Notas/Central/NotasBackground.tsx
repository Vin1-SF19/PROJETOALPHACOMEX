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
  medium: { amount: 68, size: 1.45, color: "rgba(199, 210, 254, 0.85)" },
  near: { amount: 26, size: 2, color: "rgba(255, 255, 255, 0.95)" },
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
  medium: createStars(STAR_CONFIG.medium, 5501),
  near: createStars(STAR_CONFIG.near, 6607),
};

/**
 * Fundo com profundidade de espaço para a Central de Notas — mesma técnica do CS&NPS
 * (src/app/PainelAlpha/CadastroClientes/CsNpsBackground.tsx): 3 camadas de estrelas com
 * paralaxe reativo ao mouse, glows orbitais animados na cor de tema, anéis decorativos.
 * Seeds diferentes do CS&NPS para o padrão de estrelas não ficar idêntico entre os módulos.
 */
export function NotasBackground({ accentRgb }: { accentRgb: string }) {
  const reduceMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const starsX = useSpring(useTransform(pointerX, (value) => value * 0.3), {
    stiffness: 42,
    damping: 18,
    mass: 0.7,
  });
  const starsY = useSpring(useTransform(pointerY, (value) => value * 0.3), {
    stiffness: 42,
    damping: 18,
    mass: 0.7,
  });
  const glowX = useSpring(useTransform(pointerX, (value) => value * 0.62), {
    stiffness: 35,
    damping: 18,
    mass: 0.8,
  });
  const glowY = useSpring(useTransform(pointerY, (value) => value * 0.62), {
    stiffness: 35,
    damping: 18,
    mass: 0.8,
  });

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
        style={{
          background: "linear-gradient(135deg, #020617 0%, #0b1224 38%, #071426 64%, #020617 100%)",
        }}
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
                          ? [0.55, 0.88, 0.55]
                          : layer === "medium"
                            ? [0.6, 0.84, 0.6]
                            : [0.42, 0.64, 0.42],
                    }
              }
              transition={{
                duration: layer === "distant" ? 20 : layer === "medium" ? 15 : 11,
                repeat: Infinity,
                ease: "easeInOut",
              }}
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
            background: `radial-gradient(circle, rgba(${accentRgb}, 0.15) 0%, rgba(${accentRgb}, 0.05) 38%, transparent 72%)`,
            borderRadius: "50%",
          }}
        />

        <motion.div
          animate={reduceMotion ? undefined : { x: [24, -48, 24], y: [22, -34, 22] }}
          transition={{ duration: 29, repeat: Infinity, ease: "easeInOut" }}
          className="absolute"
          style={{
            width: "50vw",
            height: "50vh",
            bottom: "-10%",
            right: "-8%",
            background: `radial-gradient(circle, rgba(14, 165, 233, 0.1) 0%, rgba(${accentRgb}, 0.035) 44%, transparent 74%)`,
            borderRadius: "50%",
          }}
        />
      </motion.div>

      <motion.div
        aria-hidden
        className="absolute left-1/2 top-[16%] h-[30rem] w-[30rem] -translate-x-1/2 rounded-full border border-white/[0.03]"
        animate={reduceMotion ? undefined : { rotate: 360, scale: [1, 1.035, 1] }}
        transition={{ duration: 38, repeat: Infinity, ease: "linear" }}
      />

      <motion.div
        aria-hidden
        className="absolute right-[10%] top-[22%] h-28 w-28 rounded-full border border-indigo-300/[0.05]"
        animate={reduceMotion ? undefined : { scale: [0.88, 1.1, 0.88], opacity: [0.16, 0.38, 0.16] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />

      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(circle at 50% 18%, transparent 0%, rgba(2, 6, 23, 0.1) 52%, rgba(2, 6, 23, 0.4) 100%)",
        }}
      />
    </div>
  );
}
