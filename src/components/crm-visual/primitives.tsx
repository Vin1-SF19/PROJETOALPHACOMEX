'use client';

import * as React from 'react';
import { useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import {
  Coins,
  Settings2,
  Radar,
  KanbanSquare,
  Paperclip,
  RefreshCw,
  Timer,
  Zap,
  Plus,
  type LucideProps,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type AccentRGB = string; // e.g. "16, 185, 129"

/* ── GlassCard ── base translúcida ───────────────────────────────── */
export function GlassCard({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'crm-glass crm-surface crm-inner-light rounded-2xl',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ── TiltSpotCard ── tilt 3D + spotlight que segue o mouse ────────── */
interface TiltSpotCardProps extends React.HTMLAttributes<HTMLDivElement> {
  maxTilt?: number;
  disableTilt?: boolean;
}
export function TiltSpotCard({
  className,
  children,
  maxTilt = 1.5,
  disableTilt = false,
  style,
  ...rest
}: TiltSpotCardProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  function setVars(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--spot-x', `${px * 100}%`);
    el.style.setProperty('--spot-y', `${py * 100}%`);
    if (reduced || disableTilt) return;
    const rx = (0.5 - py) * maxTilt * 2;
    const ry = (px - 0.5) * maxTilt * 2;
    el.style.transform = `perspective(1000px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-3px)`;
  }

  function reset() {
    const el = ref.current;
    if (!el) return;
    el.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0)';
  }

  const useTilt = !(reduced || disableTilt);

  return (
    <div
      ref={ref}
      onMouseMove={setVars}
      onMouseLeave={reset}
      className={cn(
        'crm-glass crm-surface crm-inner-light crm-spotlight rounded-2xl crm-lift',
        useTilt
          ? 'transition-[transform,box-shadow,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform'
          : 'transition-[box-shadow,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
        className,
      )}
      style={{
        ...(useTilt
          ? { transform: 'perspective(1000px)', transformStyle: 'preserve-3d' }
          : {}),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ── GlowIcon ── ícone dentro de um container com profundidade ───── */
export function GlowIcon({
  icon: Icon,
  accent,
  size = 20,
  className,
  iconClassName,
  chip = 44,
}: {
  icon: LucideIcon;
  accent: AccentRGB;
  size?: number;
  className?: string;
  iconClassName?: string;
  chip?: number;
}) {
  return (
    <span
      className={cn('crm-iconchip shrink-0 inline-grid', className)}
      style={{
        width: chip,
        height: chip,
        borderImage: undefined,
        boxShadow:
          `0 8px 18px -8px rgba(0,0,0,0.7), 0 0 22px -6px rgba(${accent},0.35), 0 1px 0 0 rgba(255,255,255,0.12) inset`,
        background: `linear-gradient(155deg, rgba(${accent},0.22), rgba(${accent},0.04) 55%), rgba(9,18,34,0.85)`,
        borderColor: `rgba(${accent},0.28)`,
      } as React.CSSProperties}
    >
      <Icon
        size={size}
        strokeWidth={1.75}
        className={iconClassName}
        style={{ color: `rgb(${accent})`, filter: `drop-shadow(0 0 6px rgba(${accent},0.55))` }}
      />
    </span>
  );
}

/* ── SectionHeader ── título estrutural com linha de acento ───────── */
export function SectionHeader({
  title,
  hint,
  className,
}: {
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-2', className)}>
      <div className="flex items-center gap-2.5">
        <span
          className="h-3.5 w-[3px] rounded-full"
          style={{ background: 'linear-gradient(180deg,#00e6c3,#3485ff)' }}
          aria-hidden
        />
        <h2 className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.14em] text-[hsl(214,30%,62%)]">
          {title}
        </h2>
      </div>
      {hint && (
        <span className="text-[11px] text-[hsl(215,18%,42%)]">{hint}</span>
      )}
    </div>
  );
}

/* ── StatusBadge ── Atrasado / Pendente / Concluído / Ativo ──────── */
export type StatusTone =
  | 'danger'
  | 'warn'
  | 'ok'
  | 'info'
  | 'accent'
  | 'muted';
const TONE_RGB: Record<StatusTone, AccentRGB> = {
  danger: '251, 113, 133',
  warn: '245, 158, 11',
  ok: '52, 211, 153',
  info: '52, 133, 255',
  accent: '0, 230, 195',
  muted: '131, 145, 167',
};
export function StatusBadge({
  label,
  tone = 'muted',
  dot = true,
  className,
}: {
  label: string;
  tone?: StatusTone;
  dot?: boolean;
  className?: string;
}) {
  const c = TONE_RGB[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold leading-none tracking-wide',
        className,
      )}
      style={{
        background: `rgba(${c},0.12)`,
        borderColor: `rgba(${c},0.28)`,
        color: `rgb(${c})`,
        boxShadow: `0 0 0 1px rgba(${c},0.05) inset`,
      }}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: `rgb(${c})`, boxShadow: `0 0 8px rgba(${c},0.8)` }}
          aria-hidden
        />
      )}
      {label}
    </span>
  );
}

/* ── Identidade visual dos pipelines (apenas apresentação) ──────── */
export type PipelineIdentity = {
  id: 'financeiro' | 'operacional' | 'radar' | 'default';
  accent: AccentRGB;
  accent2: AccentRGB;
  icon: LucideIcon;
  label: string;
};

export function getPipelineIdentity(nome: string | null | undefined): PipelineIdentity {
  const n = (nome ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  if (n.includes('radar')) {
    return {
      id: 'radar',
      accent: '139, 92, 246',
      accent2: '167, 139, 250',
      icon: Radar as LucideIcon,
      label: 'Revisão de Radar',
    };
  }
  if (n.includes('financ') || n.includes('conta')) {
    return {
      id: 'financeiro',
      accent: '16, 185, 129',
      accent2: '0, 230, 195',
      icon: Coins as LucideIcon,
      label: 'Financeiro',
    };
  }
  if (n.includes('opera') || n.includes('processo') || n.includes('operac')) {
    return {
      id: 'operacional',
      accent: '52, 133, 255',
      accent2: '34, 211, 238',
      icon: Settings2 as LucideIcon,
      label: 'Operacional',
    };
  }
  return {
    id: 'default',
    accent: '0, 230, 195',
    accent2: '52, 133, 255',
    icon: KanbanSquare as LucideIcon,
    label: nome ?? 'Pipeline',
  };
}

/* ── Ícone de atividade (apenas apresentação; não inventa dados) ── */
export function getAcaoVisual(acao: string | null | undefined): LucideIcon {
  const a = (acao ?? '').toUpperCase();
  if (a.includes('ANEXO')) return Paperclip as LucideIcon;
  if (a.includes('AUTOMACAO') || a.includes('REGRA')) return Zap as LucideIcon;
  if (a.includes('CADENCIA')) return Timer as LucideIcon;
  if (
    a.includes('MOVIDO') ||
    a.includes('ETAPA') ||
    a.includes('ESTAGIO') ||
    a.includes('SUBSTATUS') ||
    a.includes('SAIDA_LATERAL')
  )
    return RefreshCw as LucideIcon;
  if (a.includes('CRIADO') || a.includes('PROMOVIDO') || a.includes('OPORTUNIDADE'))
    return Plus as LucideIcon;
  if (a.includes('ATUALIZADO') || a.includes('EDITADO'))
    return RefreshCw as LucideIcon;
  return KanbanSquare as LucideIcon;
}

/* ── PipelineGlyph ── elemento decorativo pseudo-3D do pipeline ──── */
export function PipelineGlyph({
  identity,
  className,
  iconProps,
}: {
  identity: PipelineIdentity;
  className?: string;
  iconProps?: LucideProps;
}) {
  const { Icon } = { Icon: identity.icon };
  const isRadar = identity.id === 'radar';
  return (
    <span className={cn('relative inline-grid shrink-0 place-items-center', className)}>
      {isRadar && (
        <>
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border"
            style={{ borderColor: `rgba(${identity.accent},0.25)`, transform: 'scale(1.35)' }}
          />
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border"
            style={{ borderColor: `rgba(${identity.accent},0.16)`, transform: 'scale(1.7)' }}
          />
        </>
      )}
      <span
        className="crm-iconchip relative grid place-items-center"
        style={{
          width: 52,
          height: 52,
          background: `linear-gradient(155deg, rgba(${identity.accent},0.26), rgba(${identity.accent2},0.08) 55%, rgba(9,18,34,0.9))`,
          borderColor: `rgba(${identity.accent},0.32)`,
          boxShadow: `0 12px 22px -10px rgba(0,0,0,0.7), 0 0 26px -8px rgba(${identity.accent},0.4), 0 1px 0 0 rgba(255,255,255,0.14) inset`,
        }}
      >
        <Icon
          size={26}
          strokeWidth={1.6}
          {...iconProps}
          style={{
            color: `rgb(${identity.accent})`,
            filter: `drop-shadow(0 2px 5px rgba(0,0,0,0.5)) drop-shadow(0 0 8px rgba(${identity.accent},0.5))`,
          }}
        />
      </span>
    </span>
  );
}

/* ── Particles ── poeira leve (sem canvas, ~14 pontos) ───────────── */
const PARTICLES = [
  { top: '12%', left: '18%', d: 7, o: 0.22 },
  { top: '26%', left: '72%', d: 9, o: 0.16 },
  { top: '38%', left: '42%', d: 6, o: 0.28 },
  { top: '52%', left: '88%', d: 10, o: 0.14 },
  { top: '60%', left: '12%', d: 8, o: 0.2 },
  { top: '70%', left: '60%', d: 7, o: 0.24 },
  { top: '80%', left: '30%', d: 9, o: 0.15 },
  { top: '20%', left: '90%', d: 11, o: 0.18 },
  { top: '44%', left: '8%', d: 8, o: 0.2 },
  { top: '88%', left: '78%', d: 6, o: 0.22 },
  { top: '33%', left: '58%', d: 10, o: 0.16 },
  { top: '66%', left: '44%', d: 7, o: 0.2 },
];
export function Particles({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full crm-float"
          style={{
            top: p.top,
            left: p.left,
            width: 2,
            height: 2,
            background: 'rgba(180, 225, 255, 0.9)',
            opacity: reduced ? 0.15 : p.o,
            boxShadow: '0 0 6px rgba(120,200,255,0.6)',
            animationDelay: `${(i % 6) * 0.7}s`,
            animationDuration: `${p.d}s`,
          }}
        />
      ))}
    </div>
  );
}
