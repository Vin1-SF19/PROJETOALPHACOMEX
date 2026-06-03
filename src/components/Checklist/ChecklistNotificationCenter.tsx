'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCheck, Inbox, FileText, ArrowRight, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useChecklistNotificacoes } from '@/store/useChecklistNotificacoes';

function formatarTempo(iso: string) {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function ChecklistNotificationCenter() {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { notificacoes, marcarTodasLidas, removerNotificacao } = useChecklistNotificacoes();
  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  useEffect(() => {
    function handleClickFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  function handleAbrir() {
    setAberto((v) => !v);
    if (!aberto && naoLidas > 0) {
      setTimeout(marcarTodasLidas, 1200);
    }
  }

  function handleClicar(empresaId: string, notifId: string) {
    setAberto(false);
    removerNotificacao(notifId);
    router.push(`/PainelAlpha/CheckList/${empresaId}`);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleAbrir}
        className={`relative flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200 cursor-pointer ${
          aberto ? 'bg-blue-500/20 text-blue-300' : 'text-slate-500 hover:text-white hover:bg-white/5'
        }`}
        title="Documentos enviados por clientes"
      >
        <Bell size={15} />
        <AnimatePresence>
          {naoLidas > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22 }}
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-blue-500 text-white text-[8px] font-black flex items-center justify-center"
            >
              {naoLidas > 9 ? '9+' : naoLidas}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {aberto && (
          <motion.div
            key="dropdown"
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="absolute right-0 top-full mt-2 w-80 z-50 rounded-2xl border border-white/10 bg-[#060c1a] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <FileText size={12} className="text-blue-400" />
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Docs de Clientes
                </span>
                {naoLidas > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-[8px] font-black text-blue-400">
                    {naoLidas}
                  </span>
                )}
              </div>
              {notificacoes.length > 0 && (
                <button
                  onClick={marcarTodasLidas}
                  className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider text-slate-600 hover:text-blue-400 transition-colors cursor-pointer"
                >
                  <CheckCheck size={10} />
                  Lidas
                </button>
              )}
            </div>

            {/* Lista */}
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {notificacoes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-600">
                  <Inbox size={22} />
                  <span className="text-[9px] font-black uppercase tracking-widest">Nenhuma notificação</span>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {notificacoes.map((n) => (
                    <motion.button
                      key={n.id}
                      layout
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      onClick={() => handleClicar(n.empresaId, n.id)}
                      className={`w-full text-left px-4 py-3 border-b border-white/[0.04] last:border-0 hover:bg-white/[0.04] transition-colors flex items-start gap-3 group ${
                        !n.lida ? 'bg-blue-500/[0.04]' : ''
                      }`}
                    >
                      {/* Ícone */}
                      <div className={`mt-0.5 w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center ${
                        n.lida ? 'bg-white/5' : 'bg-blue-500/15'
                      }`}>
                        <FileText size={13} className={n.lida ? 'text-white/30' : 'text-blue-400'} />
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-[11px] font-black leading-tight truncate ${
                            n.lida ? 'text-slate-500' : 'text-white'
                          }`}>
                            {n.razaoSocial}
                          </p>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {!n.lida && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                            <span className="text-[9px] text-slate-600">{formatarTempo(n.criadoEm)}</span>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 truncate">{n.nomeArquivo}</p>
                        <p className="text-[9px] text-slate-600 italic truncate">{n.itemDescricao}</p>
                        <span className="inline-flex items-center gap-1 text-[9px] text-blue-400/70 mt-1 group-hover:text-blue-400 transition-colors">
                          Ver checklist <ArrowRight size={9} />
                        </span>
                      </div>

                      {/* Remover */}
                      <button
                        onClick={(e) => { e.stopPropagation(); removerNotificacao(n.id); }}
                        className="p-1 rounded-lg text-slate-700 hover:text-white hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                      >
                        <X size={10} />
                      </button>
                    </motion.button>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
