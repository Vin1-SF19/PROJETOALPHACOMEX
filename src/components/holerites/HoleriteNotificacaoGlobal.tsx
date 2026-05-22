'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, AlertTriangle } from 'lucide-react';
import { useHoleriteNotificacoes } from '@/store/useHoleriteNotificacoes';
import { useHoleriteNotifications } from '@/hooks/useHoleriteNotifications';
import { getUltimoAlerta } from '@/actions/HoleriteAlertas';

interface Props {
  authenticated: boolean;
}

export function HoleriteNotificacaoGlobal({ authenticated }: Props) {
  useHoleriteNotifications(authenticated);

  const alertaAtivo = useHoleriteNotificacoes((s) => s.alertaAtivo);
  const setAlerta = useHoleriteNotificacoes((s) => s.setAlerta);
  const descartarAlerta = useHoleriteNotificacoes((s) => s.descartarAlerta);

  useEffect(() => {
    if (!authenticated) return;
    getUltimoAlerta().then((alerta) => {
      if (alerta) setAlerta(alerta);
    });
  }, [authenticated, setAlerta]);

  const isFinal = alertaAtivo?.tipo === 'FINAL';

  return (
    <AnimatePresence>
      {alertaAtivo && (
        <motion.div
          key={alertaAtivo.id}
          initial={{ opacity: 0, x: 60, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 60, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="fixed bottom-6 right-6 z-[9999] w-[340px] max-w-[calc(100vw-2rem)]"
        >
          <div
            className={`relative rounded-2xl border overflow-hidden shadow-2xl backdrop-blur-sm ${
              isFinal
                ? 'bg-rose-950/90 border-rose-500/40 shadow-rose-500/20'
                : 'bg-slate-900/95 border-amber-500/30 shadow-amber-500/10'
            }`}
          >
            {/* Glow strip */}
            <div
              className={`absolute inset-x-0 top-0 h-[2px] ${
                isFinal
                  ? 'bg-gradient-to-r from-rose-600 via-red-400 to-rose-600'
                  : 'bg-gradient-to-r from-amber-600 via-yellow-400 to-amber-600'
              }`}
            />

            {isFinal && (
              <motion.div
                className="absolute inset-0 rounded-2xl border border-rose-500/20 pointer-events-none"
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
            )}

            <div className="p-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-2 rounded-xl shrink-0 ${
                      isFinal
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-amber-500/15 text-amber-400'
                    }`}
                  >
                    {isFinal ? (
                      <AlertTriangle size={16} />
                    ) : (
                      <FileText size={16} />
                    )}
                  </div>
                  <div>
                    <p
                      className={`text-[9px] font-black uppercase tracking-widest ${
                        isFinal ? 'text-rose-400' : 'text-amber-400'
                      }`}
                    >
                      {isFinal ? 'Alerta Crítico' : 'Aviso'}
                    </p>
                    <p className="text-[12px] font-black text-white leading-tight">
                      {alertaAtivo.titulo}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => descartarAlerta(alertaAtivo.id)}
                  className="shrink-0 p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors mt-0.5"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Body */}
              <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-line pl-[2.125rem]">
                {alertaAtivo.mensagem}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 pl-[2.125rem]">
                <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">
                  Alpha Holerites
                </span>
                <button
                  onClick={() => descartarAlerta(alertaAtivo.id)}
                  className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg transition-colors ${
                    isFinal
                      ? 'text-rose-400 hover:bg-rose-500/10'
                      : 'text-amber-400 hover:bg-amber-500/10'
                  }`}
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
