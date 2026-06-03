'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { X, FileText } from 'lucide-react';
import { useChecklistNotificacoes, type ChecklistNotificacao } from '@/store/useChecklistNotificacoes';

export default function ChecklistNotificationToast() {
  const notificacoes = useChecklistNotificacoes((s) => s.notificacoes);
  const removerNotificacao = useChecklistNotificacoes((s) => s.removerNotificacao);
  const router = useRouter();

  const [visivel, setVisivel] = useState<ChecklistNotificacao | null>(null);
  const [lastCount, setLastCount] = useState(0);

  useEffect(() => {
    if (notificacoes.length > lastCount && notificacoes[0]) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisivel(notificacoes[0]);
      setLastCount(notificacoes.length);
      const timer = setTimeout(() => setVisivel(null), 6000);
      return () => clearTimeout(timer);
    }
    setLastCount(notificacoes.length);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificacoes.length]);

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
            className="pointer-events-auto w-72 rounded-2xl border border-blue-500/30 bg-[#060c1a] shadow-[0_0_20px_rgba(59,130,246,0.12)] p-4 cursor-pointer"
            onClick={() => {
              setVisivel(null);
              router.push(`/PainelAlpha/CheckList/${visivel.empresaId}`);
            }}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5 w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center">
                <FileText size={14} className="text-blue-400" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border inline-block bg-blue-500/10 border-blue-500/30 text-blue-400">
                  Novo Documento — Cliente
                </span>
                <p className="text-[11px] font-black text-white leading-tight truncate">
                  {visivel.razaoSocial}
                </p>
                <p className="text-[9px] text-slate-400 font-bold truncate">
                  {visivel.nomeArquivo}
                  <span className="text-slate-600"> · {visivel.nomeCliente}</span>
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setVisivel(null);
                  removerNotificacao(visivel.id);
                }}
                className="p-1 rounded-lg text-slate-600 hover:text-white hover:bg-white/10 transition-all cursor-pointer shrink-0"
              >
                <X size={11} />
              </button>
            </div>

            <motion.div className="mt-3 h-0.5 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full bg-blue-500"
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
