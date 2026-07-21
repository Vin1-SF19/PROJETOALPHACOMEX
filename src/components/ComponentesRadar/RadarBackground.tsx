"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

type Blip = {
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
};

const ANEIS = [18, 32, 46, 60, 74];
const QUANTIDADE_BLIPS = 16;

function criarBlips(): Blip[] {
  return Array.from({ length: QUANTIDADE_BLIPS }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 2 + Math.random() * 2.5,
    delay: Math.random() * 6,
    duration: 2.5 + Math.random() * 2.5,
  }));
}

export default function RadarBackground({ accentRgb }: { accentRgb: string }) {
  const reduceMotion = useReducedMotion();
  const [blips, setBlips] = useState<Blip[]>([]);

  useEffect(() => {
    setBlips(criarBlips());
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Base escura para manter cards e textos sempre legíveis. */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(135deg, #020617 0%, #0a2146 45%, #020617 100%)",
        }}
      />

      {/* Anéis concêntricos fixos, tipo tela de sonar. */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        aria-hidden
      >
        {ANEIS.map((tamanho, i) => (
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

      {/* Linha de varredura rotativa. */}
      {!reduceMotion && (
        <motion.div
          className="absolute inset-0"
          style={{
            background: `conic-gradient(from 0deg, transparent, rgba(${accentRgb}, 0.22), transparent 18%)`,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        />
      )}

      {/* Blips — pontos "detectados" piscando aleatoriamente. */}
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
          animate={
            reduceMotion
              ? undefined
              : { opacity: [0, 1, 0] }
          }
          transition={{
            duration: blip.duration,
            delay: blip.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Vinheta para focar o centro da tela. */}
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
