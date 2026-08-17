'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CrmPipelineBorderProps {
  children: React.ReactNode;
  className?: string;
  /** Duração do ciclo de rotação em segundos (default: 1.2) */
  duration?: number;
  /** Cor do highlight no hover (default: '#6366f1' – indigo do CRM) */
  highlightColor?: string;
  /** Cor da borda em repouso (default: 'rgba(255,255,255,0.08)') */
  idleColor?: string;
  /** Raio da borda (default: '12px') */
  borderRadius?: string;
}

const DIRECOES = ['top', 'left', 'bottom', 'right'] as const;
type Direcao = (typeof DIRECOES)[number];

function posicaoGradiente(direcao: Direcao): string {
  switch (direcao) {
    case 'top':
      return '50% 0%';
    case 'left':
      return '0% 50%';
    case 'bottom':
      return '50% 100%';
    case 'right':
      return '100% 50%';
  }
}

export function CrmPipelineBorder({
  children,
  className,
  duration = 1.2,
  highlightColor = '#6366f1',
  idleColor = 'rgba(255,255,255,0.08)',
  borderRadius = '12px',
}: CrmPipelineBorderProps) {
  const reducedMotion = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [directionIndex, setDirectionIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const active = hovered || focused;
  const direction = DIRECOES[directionIndex];

  // Rotação cíclica apenas quando não está em hover/focus e sem reduced motion
  useEffect(() => {
    if (reducedMotion || active) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(() => {
      setDirectionIndex((prev) => (prev + 1) % DIRECOES.length);
    }, duration * 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [reducedMotion, active, duration]);

  // Cores do gradiente
  const gradientColor = active ? highlightColor : idleColor;
  const gradientOpacity = active ? 1 : 0.15;
  const gradientPosition = posicaoGradiente(direction);

  // Para reduced motion: borda estática com highlightColor a 30%
  const staticBorder = reducedMotion
    ? `radial-gradient(120px circle at 50% 50%, ${highlightColor}4D, transparent 70%)`
    : `radial-gradient(120px circle at ${gradientPosition}, ${gradientColor}, transparent 70%)`;

  const innerRadius = `calc(${borderRadius} - 1.5px)`;

  return (
    <div
      role="none"
      className={cn('relative rounded-[12px] p-[1.5px] overflow-hidden', className)}
      style={{ borderRadius }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
    >
      {/* Layer de gradiente animado (decorativo) */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: staticBorder,
          filter: 'blur(2px)',
          opacity: gradientOpacity,
          transition: reducedMotion ? 'none' : 'opacity 300ms ease-out, background 300ms ease-out',
        }}
        animate={
          reducedMotion
            ? undefined
            : {
                opacity: gradientOpacity,
                background: staticBorder,
              }
        }
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />

      {/* Highlight central no hover (decorativo) */}
      {active && !reducedMotion && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{
            background: `radial-gradient(200px circle at 50% 50%, ${highlightColor}, transparent 70%)`,
            filter: 'blur(3px)',
          }}
        />
      )}

      {/* Inner content */}
      <div
        className="relative z-10 h-full overflow-y-auto bg-[#0f1629]"
        style={{ borderRadius: innerRadius }}
      >
        {children}
      </div>
    </div>
  );
}
