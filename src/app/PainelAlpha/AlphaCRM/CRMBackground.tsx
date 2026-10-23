'use client';

import { useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Particles } from '@/components/crm-visual';

interface CrmSpaceBackgroundProps {
  className?: string;
  /** Mantido apenas para compatibilidade; a base são as imagens de cada tema */
  intensity?: 'low' | 'medium' | 'high';
}

export function CrmSpaceBackground({ className }: CrmSpaceBackgroundProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn('absolute inset-0 z-0 overflow-hidden pointer-events-none crm-bg-ambient', className)}
      aria-hidden="true"
    >
      {/* Uma imagem por tema (public/backgroundEscuroCRM.png e backgroundClaroCRM.png);
          as duas ficam montadas e o tema ativo decide qual aparece (crossfade via CSS).
          Cada camada traz o próprio overlay de legibilidade. */}
      <div className="crm-bg-media crm-bg-media--escuro" />
      <div className="crm-bg-media crm-bg-media--claro" />

      {/* Poeira decorativa (respeita reduced-motion) */}
      {!reduceMotion && <Particles className="crm-particulas" />}
    </div>
  );
}
