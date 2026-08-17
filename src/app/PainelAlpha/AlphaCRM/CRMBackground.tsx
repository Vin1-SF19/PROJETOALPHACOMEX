'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckSquare, TrendingUp, Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CrmSpaceBackgroundProps {
  className?: string;
  intensity?: 'low' | 'medium' | 'high';
}

interface Star {
  id: number;
  top: number;
  left: number;
  duration: number;
  delay: number;
}

const INTENSITY_CONFIG = {
  low: { opacityMin: 0.15, opacityMax: 0.5, speedMultiplier: 1.5 },
  medium: { opacityMin: 0.2, opacityMax: 0.8, speedMultiplier: 1 },
  high: { opacityMin: 0.3, opacityMax: 1, speedMultiplier: 0.7 },
} as const;

function generateStars(count: number): Star[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    top: Math.random() * 100,
    left: Math.random() * 100,
    duration: 3 + Math.random() * 5,
    delay: Math.random() * 2,
  }));
}

export function CrmSpaceBackground({ className, intensity = 'medium' }: CrmSpaceBackgroundProps) {
  const reduceMotion = useReducedMotion();
  const [isMobile, setIsMobile] = useState(false);
  const config = INTENSITY_CONFIG[intensity];

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const starCount = isMobile ? 25 : 60;
  const stars = useMemo(() => generateStars(starCount), [starCount]);

  const nebulaAnimate = reduceMotion || isMobile ? undefined : true;

  return (
    <div
      className={cn('absolute inset-0 z-0 overflow-hidden pointer-events-none', className)}
      aria-hidden="true"
    >
      {/* Base gradient escuro */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, #0f1629 0%, #0a0e1a 50%, #060b14 100%)',
        }}
      />

      {/* Partículas / estrelas */}
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute w-0.5 h-0.5 rounded-full bg-white/40"
          style={{
            top: `${star.top}%`,
            left: `${star.left}%`,
            willChange: 'opacity',
          }}
          animate={
            reduceMotion
              ? { opacity: 0.4 }
              : { opacity: [config.opacityMin, config.opacityMax, config.opacityMin] }
          }
          transition={
            reduceMotion
              ? undefined
              : {
                  duration: star.duration * config.speedMultiplier,
                  repeat: Infinity,
                  repeatType: 'reverse',
                  delay: star.delay,
                  ease: 'easeInOut',
                }
          }
        />
      ))}

      {/* Nébulas — cores derivadas dos módulos de referência */}
      {/* Checklist → azul-ciano */}
      <motion.div
        className="absolute w-[600px] h-[400px] rounded-full blur-[120px]"
        style={{
          top: '10%',
          left: '20%',
          background: 'rgba(59, 130, 246, 0.08)',
        }}
        animate={
          nebulaAnimate
            ? { x: [0, 30, 0], y: [0, -20, 0] }
            : { opacity: 1 }
        }
        transition={
          nebulaAnimate
            ? { duration: 20, repeat: Infinity, ease: 'easeInOut' }
            : undefined
        }
      />
      {/* CS & NPS → verde-âmbar */}
      <motion.div
        className="absolute w-[600px] h-[400px] rounded-full blur-[120px]"
        style={{
          top: '60%',
          left: '70%',
          background: 'rgba(16, 185, 129, 0.06)',
        }}
        animate={
          nebulaAnimate
            ? { x: [0, -25, 0], y: [0, 15, 0] }
            : { opacity: 1 }
        }
        transition={
          nebulaAnimate
            ? { duration: 25, repeat: Infinity, ease: 'easeInOut' }
            : undefined
        }
      />
      {/* Extratos → violeta */}
      <motion.div
        className="absolute w-[600px] h-[400px] rounded-full blur-[120px]"
        style={{
          top: '30%',
          left: '80%',
          background: 'rgba(139, 92, 246, 0.07)',
        }}
        animate={
          nebulaAnimate
            ? { x: [0, 20, 0], y: [0, 25, 0] }
            : { opacity: 1 }
        }
        transition={
          nebulaAnimate
            ? { duration: 22, repeat: Infinity, ease: 'easeInOut' }
            : undefined
        }
      />

      {/* Ícones sutis — semântica dos módulos */}
      <div className="absolute top-[15%] left-[10%] w-8 h-8 text-white/[0.03] rotate-12">
        <CheckSquare className="w-full h-full" />
      </div>
      <div className="absolute top-[70%] left-[80%] w-8 h-8 text-white/[0.03] -rotate-6">
        <TrendingUp className="w-full h-full" />
      </div>
      <div className="absolute top-[40%] left-[50%] w-8 h-8 text-white/[0.03] rotate-45">
        <Banknote className="w-full h-full" />
      </div>
    </div>
  );
}
