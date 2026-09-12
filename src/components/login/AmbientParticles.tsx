"use client";

import { memo, useMemo, type CSSProperties } from "react";

type Props = {
  reducedMotion: boolean;
  count?: number;
};

type Particle = {
  id: number;
  left: number;
  top: number;
  size: number;
  red: boolean;
  duration: number;
  delay: number;
  drift: number;
  opacity: number;
};

function makeParticles(count: number): Particle[] {
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const seed = (i * 2654435761) % 1000;
    out.push({
      id: i,
      left: (seed / 1000) * 100,
      top: (i * 37) % 100,
      size: 1 + ((i * 13) % 3),
      red: i % 3 === 0,
      duration: 6 + ((i * 7) % 9),
      delay: (i % 10) * 0.6,
      drift: 8 + ((i * 5) % 18),
      opacity: 0.15 + ((i * 11) % 40) / 100,
    });
  }
  return out;
}

function AmbientParticlesComponent({ reducedMotion, count = 26 }: Props) {
  const particles = useMemo(() => makeParticles(count), [count]);

  if (reducedMotion) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      {particles.map((p) => {
        const style = {
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            background: p.red
              ? "rgba(239,68,68,0.9)"
              : "rgba(148,197,255,0.7)",
            boxShadow: p.red
              ? "0 0 6px rgba(239,68,68,0.8)"
              : "0 0 6px rgba(96,165,250,0.6)",
            opacity: p.opacity,
            animation: `loginFloat ${p.duration}s ease-in-out ${p.delay}s infinite, ${
              p.red ? "loginLed" : "loginTwinkle"
            } ${p.duration * 0.6}s ease-in-out ${p.delay}s infinite`,
            "--drift": `${p.drift}px`,
          } satisfies CSSProperties & Record<"--drift", string>;

        return <span key={p.id} className="login-particle absolute rounded-full" style={style} />;
      })}
    </div>
  );
}

export const AmbientParticles = memo(AmbientParticlesComponent);
