'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { X, AlertTriangle, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { useChamadoNotificacoes, type ChamadoNotificacao } from '@/store/useChamadoNotificacoes';

const URGENCIA_CONFIG = {
  URGENTE: {
    icon: AlertTriangle,
    label: 'URGENTE — Novo Chamado',
    border: 'border-rose-500/50',
    bg: 'bg-[#0f0a10]',
    glow: 'shadow-[0_0_28px_rgba(244,63,94,0.2)]',
    iconColor: 'text-rose-400',
    badge: 'bg-rose-500/15 border-rose-500/40 text-rose-400',
  },
  ALTA: {
    icon: AlertCircle,
    label: 'ALTA — Novo Chamado',
    border: 'border-rose-400/30',
    bg: 'bg-[#0f0a10]',
    glow: 'shadow-[0_0_18px_rgba(244,63,94,0.12)]',
    iconColor: 'text-rose-400',
    badge: 'bg-rose-500/10 border-rose-400/20 text-rose-400',
  },
  MEDIA: {
    icon: AlertCircle,
    label: 'MÉDIA — Novo Chamado',
    border: 'border-amber-500/30',
    bg: 'bg-[#0f0d0a]',
    glow: 'shadow-[0_0_14px_rgba(245,158,11,0.1)]',
    iconColor: 'text-amber-400',
    badge: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  },
  BAIXA: {
    icon: Info,
    label: 'Novo Chamado',
    border: 'border-emerald-500/20',
    bg: 'bg-[#090f0a]',
    glow: '',
    iconColor: 'text-emerald-400',
    badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  },
  CONCLUIDO: {
    icon: CheckCircle2,
    label: 'Chamado concluído',
    border: 'border-emerald-400/30',
    bg: 'bg-[#07110d]',
    glow: 'shadow-[0_0_18px_rgba(52,211,153,0.14)]',
    iconColor: 'text-emerald-400',
    badge: 'bg-emerald-500/10 border-emerald-400/25 text-emerald-300',
  },
} as const;

const FALLBACK = URGENCIA_CONFIG.MEDIA;

export default function NotificationToast() {
  const notificacoes = useChamadoNotificacoes((s) => s.notificacoes);
  const removerNotificacao = useChamadoNotificacoes((s) => s.removerNotificacao);
  const router = useRouter();

  const [visivel, setVisivel] = useState<ChamadoNotificacao | null>(null);
  const filaRef = useRef<ChamadoNotificacao[]>([]);
  const enfileiradosRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Exibe um toast por vez, na ordem de chegada — se dois eventos chegarem em
  // sequência rápida (ex.: dois chamados abertos quase juntos), o segundo entra
  // na fila em vez de substituir o primeiro antes do usuário conseguir vê-lo.
  const mostrarProximoRef = useRef<() => void>(() => {});
  useEffect(() => {
    mostrarProximoRef.current = () => {
      const proximo = filaRef.current.shift();
      if (!proximo) {
        timerRef.current = null;
        setVisivel(null);
        return;
      }
      setVisivel(proximo);
      timerRef.current = setTimeout(() => mostrarProximoRef.current(), 6000);
    };
  });
  const mostrarProximo = useCallback(() => mostrarProximoRef.current(), []);

  useEffect(() => {
    for (const n of notificacoes) {
      if (enfileiradosRef.current.has(n.id)) continue;
      enfileiradosRef.current.add(n.id);
      filaRef.current.push(n);
    }
    // Evita crescimento ilimitado do Set em sessões longas (mesmo limite do store).
    if (enfileiradosRef.current.size > 50) {
      const idsAtuais = new Set(notificacoes.map((n) => n.id));
      enfileiradosRef.current = new Set(
        [...enfileiradosRef.current].filter((id) => idsAtuais.has(id)),
      );
    }
    if (!timerRef.current) mostrarProximo();
  }, [notificacoes, mostrarProximo]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const dispensar = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    mostrarProximo();
  }, [mostrarProximo]);

  const config = visivel
    ? (URGENCIA_CONFIG[visivel.urgencia as keyof typeof URGENCIA_CONFIG] ?? FALLBACK)
    : FALLBACK;
  const Icon = config.icon;

  return (
    <div className="fixed bottom-6 right-6 z-[200] pointer-events-none">
      <AnimatePresence>
        {visivel && (
          <motion.div
            key={visivel.id}
            initial={{ opacity: 0, x: 60, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 360, damping: 26 }}
            className={`
              pointer-events-auto w-72 rounded-2xl border p-4 cursor-pointer
              ${config.border} ${config.bg} ${config.glow}
            `}
            onClick={() => {
              dispensar();
              router.push('/PainelAlpha/Chamados');
            }}
          >
            <div className="flex items-start gap-3">
              <div className={`shrink-0 mt-0.5 ${config.iconColor}`}>
                <Icon size={15} />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border inline-block ${config.badge}`}>
                  {config.label}
                </span>
                <p className="text-[11px] font-black text-white leading-tight truncate">
                  {visivel.titulo}
                </p>
                <p className="text-[9px] text-slate-400 font-bold truncate">
                  {visivel.usuario}
                  {visivel.setor ? <span className="text-slate-600"> · {visivel.setor}</span> : null}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removerNotificacao(visivel.id);
                  dispensar();
                }}
                className="p-1 rounded-lg text-slate-600 hover:text-white hover:bg-white/10 transition-all cursor-pointer shrink-0"
              >
                <X size={11} />
              </button>
            </div>

            <motion.div
              className="mt-3 h-0.5 rounded-full bg-white/5 overflow-hidden"
            >
              <motion.div
                className={`h-full ${config.iconColor.replace('text-', 'bg-')}`}
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 6, ease: 'linear' }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
