'use client';

import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Particles } from '@/components/crm-visual';

interface CrmSpaceBackgroundProps {
  className?: string;
  /** Mantido apenas para compatibilidade; a base é o backgroundCRM.png */
  intensity?: 'low' | 'medium' | 'high';
}

export function CrmSpaceBackground({ className }: CrmSpaceBackgroundProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn('absolute inset-0 z-0 overflow-hidden pointer-events-none crm-bg-ambient', className)}
      aria-hidden="true"
    >
      {/* Imagem oficial do CRM (public/backgroundCRM.png) com parallax leve via CSS vars */}
      <div className="crm-bg-media" />

      {/* Overlay escuro para garantir legibilidade */}
      <div className="crm-bg-overlay" />

      {/* Poeira decorativa (respeita reduced-motion) */}
      {!reduceMotion && <Particles />}
    </div>
  );
}
