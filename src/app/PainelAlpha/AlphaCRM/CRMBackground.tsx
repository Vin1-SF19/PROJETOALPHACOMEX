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
      className={cn('fixed inset-0 z-0 overflow-hidden pointer-events-none crm-bg-ambient', className)}
      aria-hidden="true"
    >
      {/* Uma imagem por tema (public/backgroundEscuroCRM.png e backgroundClaroCRM.png);
          as duas ficam montadas e o tema ativo decide qual aparece (crossfade via CSS).
          Fixo na viewport: não amplia com a altura do conteúdo. A imagem ocupa a altura
          inteira sem corte; em telas mais largas que 16:9 (ultrawide) as laterais recebem
          a mesma imagem desfocada. Cada camada traz o próprio overlay de legibilidade. */}
      {(['escuro', 'claro'] as const).map((tema) => (
        <div key={tema} className={`crm-bg-media crm-bg-media--${tema}`}>
          <div className="crm-bg-preenchimento" />
          <div className="crm-bg-imagem" />
        </div>
      ))}

      {/* Poeira decorativa (respeita reduced-motion) */}
      {!reduceMotion && <Particles className="crm-particulas" />}
    </div>
  );
}
