"use client";

import { memo, useMemo } from "react";

type Props = {
  reducedMotion: boolean;
  active: boolean;
};

type Led = {
  id: number;
  left: number;
  top: number;
  size: number;
  duration: number;
  delay: number;
};

function makeLeds(): Led[] {
  const out: Led[] = [];
  for (let i = 0; i < 14; i++) {
    const seed = (i * 40503) % 100;
    out.push({
      id: i,
      left: 8 + (seed % 84),
      top: 12 + ((i * 23) % 70),
      size: 2 + ((i * 7) % 4),
      duration: [2.5, 4, 6][i % 3],
      delay: (i % 7) * 0.7,
    });
  }
  return out;
}

function LedNetworkComponent({ reducedMotion, active }: Props) {
  const leds = useMemo(() => makeLeds(), []);

  return (
    <div
      className="pointer-events-none absolute inset-0"
      aria-hidden
      style={{ opacity: active ? 1 : 0.7, transition: "opacity 600ms ease" }}
    >
      {leds.map((l) => (
        <span
          key={l.id}
          className="absolute rounded-full"
          style={{
            left: `${l.left}%`,
            top: `${l.top}%`,
            width: l.size,
            height: l.size,
            background: "radial-gradient(circle, rgba(255,120,120,1) 0%, rgba(239,68,68,0.9) 40%, rgba(239,68,68,0) 70%)",
            boxShadow: "0 0 10px rgba(239,68,68,0.7), 0 0 22px rgba(239,68,68,0.35)",
            animation: reducedMotion
              ? undefined
              : `loginLed ${l.duration}s ease-in-out ${l.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

export const LedNetwork = memo(LedNetworkComponent);
