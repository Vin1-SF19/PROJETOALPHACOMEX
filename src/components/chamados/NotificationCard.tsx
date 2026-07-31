'use client';

import { motion } from 'framer-motion';
import { X, AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ChamadoNotificacao } from '@/store/useChamadoNotificacoes';

interface Props {
  notificacao: ChamadoNotificacao;
  onRemover: (id: string) => void;
}

const URGENCIA_CONFIG = {
  URGENTE: {
    icon: AlertTriangle,
    label: 'URGENTE',
    border: 'border-rose-500/40',
    bg: 'bg-rose-500/5',
    glow: 'shadow-[0_0_20px_rgba(244,63,94,0.15)]',
    iconColor: 'text-rose-400',
    badge: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
    titleColor: 'text-rose-100',
  },
  ALTA: {
    icon: AlertCircle,
    label: 'ALTA',
    border: 'border-rose-400/30',
    bg: 'bg-rose-500/5',
    glow: 'shadow-[0_0_14px_rgba(244,63,94,0.1)]',
    iconColor: 'text-rose-400',
    badge: 'bg-rose-500/10 border-rose-400/20 text-rose-400',
    titleColor: 'text-rose-100',
  },
  MEDIA: {
    icon: AlertCircle,
    label: 'MÉDIA',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    glow: 'shadow-[0_0_12px_rgba(245,158,11,0.08)]',
    iconColor: 'text-amber-400',
    badge: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    titleColor: 'text-amber-100',
  },
  BAIXA: {
    icon: Info,
    label: 'BAIXA',
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/5',
    glow: '',
    iconColor: 'text-emerald-400',
    badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    titleColor: 'text-emerald-100',
  },
  CONCLUIDO: {
    icon: CheckCircle,
    label: 'CONCLUÍDO',
    border: 'border-emerald-400/30',
    bg: 'bg-emerald-500/5',
    glow: 'shadow-[0_0_16px_rgba(52,211,153,0.12)]',
    iconColor: 'text-emerald-400',
    badge: 'bg-emerald-500/10 border-emerald-400/25 text-emerald-300',
    titleColor: 'text-emerald-100',
  },
} as const;

const FALLBACK_CONFIG = {
  icon: CheckCircle,
  label: 'CHAMADO',
  border: 'border-indigo-500/20',
  bg: 'bg-indigo-500/5',
  glow: '',
  iconColor: 'text-indigo-400',
  badge: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
  titleColor: 'text-white',
};

export default function NotificationCard({ notificacao, onRemover }: Props) {
  const router = useRouter();
  const config = URGENCIA_CONFIG[notificacao.urgencia as keyof typeof URGENCIA_CONFIG] ?? FALLBACK_CONFIG;
  const Icon = config.icon;

  const horario = (() => {
    try {
      return formatDistanceToNow(new Date(notificacao.createdAt), {
        addSuffix: true,
        locale: ptBR,
      });
    } catch {
      return 'agora';
    }
  })();

  const isUrgente = notificacao.urgencia === 'URGENTE';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      onClick={() => router.push('/PainelAlpha/Chamados')}
      className={`
        relative group cursor-pointer rounded-2xl border p-4
        ${config.border} ${config.bg} ${config.glow}
        hover:brightness-110 transition-all duration-200
        ${isUrgente ? 'animate-pulse-glow' : ''}
      `}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemover(notificacao.id);
        }}
        className="absolute top-3 right-3 p-1 rounded-lg text-slate-600 hover:text-white hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
      >
        <X size={11} />
      </button>

      <div className="flex items-start gap-3 pr-5">
        <div className={`mt-0.5 shrink-0 ${config.iconColor}`}>
          <Icon size={15} />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border ${config.badge}`}>
              {config.label}
            </span>
            {!notificacao.lida && (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
            )}
          </div>
          <p className={`text-[10px] font-black leading-tight truncate ${config.titleColor}`}>
            {notificacao.titulo}
          </p>
          <p className="text-[9px] text-slate-400 font-bold truncate">
            {notificacao.usuario}
            {notificacao.setor ? (
              <span className="text-slate-600"> · {notificacao.setor}</span>
            ) : null}
          </p>
          <p className="text-[8px] text-slate-600 font-bold">{horario}</p>
        </div>
      </div>
    </motion.div>
  );
}
