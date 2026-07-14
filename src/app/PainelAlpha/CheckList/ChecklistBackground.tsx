"use client";

import { useEffect, useState } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";

type StarLayer = "distant" | "medium" | "near";

const STAR_CONFIG: Record<StarLayer, { amount: number; size: number; color: string }> = {
  distant: { amount: 170, size: 1, color: "rgba(226, 232, 240, 0.8)" },
  medium: { amount: 82, size: 1.5, color: "rgba(191, 219, 254, 0.9)" },
  near: { amount: 36, size: 2, color: "rgba(255, 255, 255, 0.98)" },
};

function createStars({ amount, size, color }: (typeof STAR_CONFIG)[StarLayer]) {
  return Array.from({ length: amount }, () => {
    const x = Math.floor(Math.random() * 2560);
    const y = Math.floor(Math.random() * 2200);
    const glow = size > 1 ? `, 0 0 ${size * 3}px ${color}` : "";

    return `${x}px ${y}px 0 ${color}${glow}`;
  }).join(", ");
}

export default function ChecklistBackground({ accentRgb }: { accentRgb: string }) {
  const reduceMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const starsX = useSpring(useTransform(pointerX, (value) => value * 0.35), {
    stiffness: 42,
    damping: 18,
    mass: 0.7,
  });
  const starsY = useSpring(useTransform(pointerY, (value) => value * 0.35), {
    stiffness: 42,
    damping: 18,
    mass: 0.7,
  });
  const glowX = useSpring(useTransform(pointerX, (value) => value * 0.7), {
    stiffness: 35,
    damping: 18,
    mass: 0.8,
  });
  const glowY = useSpring(useTransform(pointerY, (value) => value * 0.7), {
    stiffness: 35,
    damping: 18,
    mass: 0.8,
  });
  const [stars, setStars] = useState<Record<StarLayer, string>>({
    distant: "",
    medium: "",
    near: "",
  });

  useEffect(() => {
    setStars({
      distant: createStars(STAR_CONFIG.distant),
      medium: createStars(STAR_CONFIG.medium),
      near: createStars(STAR_CONFIG.near),
    });
  }, []);

  useEffect(() => {
    if (reduceMotion || !window.matchMedia("(pointer: fine)").matches) return;

    const updateParallax = (event: PointerEvent) => {
      pointerX.set((event.clientX / window.innerWidth - 0.5) * 18);
      pointerY.set((event.clientY / window.innerHeight - 0.5) * 14);
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
      {/* Base escura para manter cards e textos sempre legíveis. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #020617 0%, #0a2146 45%, #020617 100%)",
        }}
      />

      {/* Ceu estrelado em tres profundidades, sem a grade anterior. */}
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
                boxShadow: stars[layer],
                opacity: layer === "distant" ? 0.62 : layer === "medium" ? 0.82 : 1,
              }}
              animate={
                reduceMotion
                  ? undefined
                  : {
                      y: layer === "distant" ? [0, -18, 0] : layer === "medium" ? [0, -28, 0] : [0, -38, 0],
                      opacity:
                        layer === "near"
                          ? [0.64, 0.92, 0.64]
                          : layer === "medium"
                            ? [0.68, 0.92, 0.68]
                            : [0.48, 0.72, 0.48],
                    }
              }
              transition={{
                duration: layer === "distant" ? 18 : layer === "medium" ? 13 : 9,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          );
        })}
      </motion.div>

      {/* Luz do tema ativo: acompanha a identidade escolhida pelo usuário. */}
      <motion.div className="absolute inset-0" style={{ x: glowX, y: glowY }}>
        <motion.div
          animate={reduceMotion ? undefined : { x: [-40, 60, -40], y: [-20, 50, -20] }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute"
          style={{
            width: "70vw",
            height: "70vh",
            top: "-15%",
            left: "-10%",
            background: `radial-gradient(circle, rgba(${accentRgb}, 0.18) 0%, rgba(${accentRgb}, 0.06) 38%, transparent 72%)`,
            borderRadius: "50%",
          }}
        />

        <motion.div
          animate={reduceMotion ? undefined : { x: [30, -60, 30], y: [30, -40, 30] }}
          transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
          className="absolute"
          style={{
            width: "55vw",
            height: "55vh",
            bottom: "-10%",
            right: "-8%",
            background: `radial-gradient(circle, rgba(${accentRgb}, 0.13) 0%, rgba(${accentRgb}, 0.035) 42%, transparent 72%)`,
            borderRadius: "50%",
          }}
        />
      </motion.div>

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 20%, transparent 0%, rgba(2, 6, 23, 0.1) 55%, rgba(2, 6, 23, 0.34) 100%)",
        }}
      />
    </div>
  );
}
