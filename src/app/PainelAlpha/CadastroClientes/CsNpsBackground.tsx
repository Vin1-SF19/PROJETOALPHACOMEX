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
  distant: { amount: 155, size: 1, color: "rgba(226, 232, 240, 0.74)" },
  medium: { amount: 76, size: 1.45, color: "rgba(199, 210, 254, 0.88)" },
  near: { amount: 31, size: 2, color: "rgba(255, 255, 255, 0.96)" },
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
  distant: createStars(STAR_CONFIG.distant, 1103),
  medium: createStars(STAR_CONFIG.medium, 2207),
  near: createStars(STAR_CONFIG.near, 3301),
};

export default function CsNpsBackground({ accentRgb }: { accentRgb: string }) {
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
          background:
            "linear-gradient(135deg, #020617 0%, #081d3f 38%, #071426 64%, #020617 100%)",
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
                opacity: layer === "distant" ? 0.58 : layer === "medium" ? 0.78 : 0.95,
              }}
              animate={
                reduceMotion
                  ? undefined
                  : {
                      y: layer === "distant" ? [0, -16, 0] : layer === "medium" ? [0, -25, 0] : [0, -34, 0],
                      opacity:
                        layer === "near"
                          ? [0.58, 0.9, 0.58]
                          : layer === "medium"
                            ? [0.62, 0.86, 0.62]
                            : [0.44, 0.66, 0.44],
                    }
              }
              transition={{
                duration: layer === "distant" ? 19 : layer === "medium" ? 14 : 10,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          );
        })}
      </motion.div>

      <motion.div className="absolute inset-0" style={{ x: glowX, y: glowY }}>
        <motion.div
          animate={reduceMotion ? undefined : { x: [-34, 56, -34], y: [-18, 44, -18] }}
          transition={{ duration: 21, repeat: Infinity, ease: "easeInOut" }}
          className="absolute"
          style={{
            width: "68vw",
            height: "68vh",
            top: "-16%",
            left: "-12%",
            background: `radial-gradient(circle, rgba(${accentRgb}, 0.16) 0%, rgba(${accentRgb}, 0.055) 38%, transparent 72%)`,
            borderRadius: "50%",
          }}
        />

        <motion.div
          animate={reduceMotion ? undefined : { x: [26, -54, 26], y: [24, -38, 24] }}
          transition={{ duration: 27, repeat: Infinity, ease: "easeInOut" }}
          className="absolute"
          style={{
            width: "56vw",
            height: "56vh",
            bottom: "-11%",
            right: "-9%",
            background: `radial-gradient(circle, rgba(14, 165, 233, 0.11) 0%, rgba(${accentRgb}, 0.04) 44%, transparent 74%)`,
            borderRadius: "50%",
          }}
        />
      </motion.div>

      <motion.div
        aria-hidden
        className="absolute left-1/2 top-[18%] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full border border-white/[0.035]"
        animate={reduceMotion ? undefined : { rotate: 360, scale: [1, 1.04, 1] }}
        transition={{ duration: 34, repeat: Infinity, ease: "linear" }}
      />

      <motion.div
        aria-hidden
        className="absolute right-[9%] top-[24%] h-32 w-32 rounded-full border border-indigo-300/[0.055]"
        animate={reduceMotion ? undefined : { scale: [0.88, 1.12, 0.88], opacity: [0.18, 0.42, 0.18] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 18%, transparent 0%, rgba(2, 6, 23, 0.12) 52%, rgba(2, 6, 23, 0.42) 100%)",
        }}
      />
    </div>
  );
}
