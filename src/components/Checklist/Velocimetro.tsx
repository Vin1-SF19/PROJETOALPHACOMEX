"use client";

import { useEffect } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, { w: number; h: number; r: number; sw: number; fontSize: number }> = {
  sm: { w: 120, h: 70,  r: 40, sw: 8,  fontSize: 14 },
  md: { w: 160, h: 95,  r: 55, sw: 10, fontSize: 18 },
  lg: { w: 240, h: 140, r: 80, sw: 14, fontSize: 28 },
};

function getArcColor(percent: number): string {
  if (percent < 34) return "#ef4444";
  if (percent < 67) return "#eab308";
  return "#22c55e";
}

interface Props {
  percent: number;
  size?: Size;
  animated?: boolean;
  showLabel?: boolean;
  accentRgb?: string; // Se fornecido, usa cor do tema no arco + glow
}

export default function Velocimetro({
  percent,
  size = "md",
  animated = true,
  showLabel = true,
  accentRgb,
}: Props) {
  const { w, h, r, sw, fontSize } = SIZES[size];
  const cx = w / 2;
  const cy = h - sw / 2 - 2;

  const circumference = Math.PI * r;
  const clampedPercent = Math.max(0, Math.min(100, percent));

  const raw = useMotionValue(animated ? 0 : clampedPercent);
  const spring = useSpring(raw, { stiffness: 60, damping: 18 });

  useEffect(() => {
    raw.set(clampedPercent);
  }, [clampedPercent, raw]);

  const offset = useTransform(spring, (v) => circumference - (v / 100) * circumference);
  const needleLength = r - sw - 2;
  const needleX = useTransform(
    spring,
    (v) => cx + needleLength * Math.cos((1 - v / 100) * Math.PI)
  );
  const needleY = useTransform(
    spring,
    (v) => cy - needleLength * Math.sin((1 - v / 100) * Math.PI)
  );
  const needlePath = useMotionTemplate`M ${cx} ${cy} L ${needleX} ${needleY}`;

  // Cor: usa tema se fornecido, senão segue progresso
  const arcColor = accentRgb ? `rgb(${accentRgb})` : getArcColor(clampedPercent);
  const needleColor = accentRgb ? `rgb(${accentRgb})` : getArcColor(clampedPercent);

  const gradId = `vel-${size}-${accentRgb ? "theme" : "progress"}-${Math.round(clampedPercent / 10) * 10}`;
  const filterId = `vel-glow-${size}`;

  const showGlow = clampedPercent >= 70;

  return (
    <div className="flex flex-col items-center gap-1 select-none">
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        overflow="visible"
        style={showGlow && accentRgb ? { filter: `drop-shadow(0 0 6px rgba(${accentRgb}, 0.55))` } : undefined}
      >
        <defs>
          {accentRgb ? (
            /* Gradiente do tema: transparente → accent → accent mais claro */
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={`rgba(${accentRgb}, 0.4)`} />
              <stop offset="100%" stopColor={`rgb(${accentRgb})`} />
            </linearGradient>
          ) : (
            /* Gradiente padrão de progresso */
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          )}
        </defs>

        {/* Trilho de fundo */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={sw}
          strokeLinecap="round"
        />

        {/* Arco de progresso */}
        <motion.path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: offset }}
        />

        {/* Agulha */}
        <motion.path
          d={needlePath}
          fill="none"
          stroke={needleColor}
          strokeWidth={size === "lg" ? 2.5 : 2}
          strokeLinecap="round"
        />

        {/* Ponto central */}
        <circle
          cx={cx}
          cy={cy}
          r={size === "lg" ? 5 : 3.5}
          fill={arcColor}
          style={showGlow && accentRgb ? { filter: `drop-shadow(0 0 4px ${arcColor})` } : undefined}
        />

        {/* Percentual */}
        {showLabel && (
          <text
            x={cx}
            y={cy - r / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontWeight="900"
            fontSize={fontSize}
            fontFamily="inherit"
          >
            {Math.round(clampedPercent)}%
          </text>
        )}

        {/* Labels 0% e 100% */}
        <text x={cx - r - 2} y={cy + sw + 4} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize={8} fontFamily="inherit">0%</text>
        <text x={cx + r + 2} y={cy + sw + 4} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize={8} fontFamily="inherit">100%</text>
      </svg>

      {showLabel && (
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Concluído</p>
      )}
    </div>
  );
}
