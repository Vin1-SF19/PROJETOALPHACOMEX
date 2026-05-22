'use client';

import { useEffect, useState, useTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Building2, Check, Users, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { MODULOS_REGISTRY } from '@/lib/modulos-registry';
import {
  listarPermissoesPorSetor,
  atribuirModulosAoSetor,
} from '@/actions/PermissoesSetor';

const SETORES = [
  'OPERACIONAL', 'COMERCIAL', 'Lider Comercial', 'FINANCEIRO', 'RECURSOS HUMANOS',
  'JURÍDICO', 'PARCEIRO', 'Serviços Gerais', 'CEO',
];

const MODULOS_GERENCIAVEIS = MODULOS_REGISTRY.filter(m => m.permission && !m.adminOnly);

interface Props {
  open: boolean;
  onClose: () => void;
  totalUsers: Record<string, number>;
}

export default function ModalGerenciarSetor({ open, onClose, totalUsers }: Props) {
  const [setorAtivo, setSetorAtivo] = useState(SETORES[0]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    listarPermissoesPorSetor(setorAtivo).then(modulos => {
      setSelecionados(new Set(modulos));
    });
  }, [setorAtivo, open]);

  function toggle(permId: string) {
    setSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  }

  function handleSalvar() {
    startTransition(async () => {
      const result = await atribuirModulosAoSetor({
        setor: setorAtivo,
        modulos: Array.from(selecionados),
      });
      if (result.success) {
        toast.success(`Permissões do setor ${setorAtivo} salvas — ${result.afetados} usuário(s) afetado(s)`);
      } else {
        toast.error('Erro ao salvar permissões');
      }
    });
  }

  const afetados = totalUsers[setorAtivo] ?? 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          >
            <div
              className="w-full max-w-2xl bg-[#060c1a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-7 py-5 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                    <Building2 size={18} className="text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-white uppercase tracking-tight italic">
                      Gerenciador de Permissões
                    </h2>
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">por setor</p>
                  </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {/* Setor selector */}
                <div className="space-y-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Setor</span>
                  <div className="flex flex-wrap gap-2">
                    {SETORES.map(s => (
                      <button
                        key={s}
                        onClick={() => setSetorAtivo(s)}
                        className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all cursor-pointer ${
                          setorAtivo === s
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'bg-white/5 border-white/5 text-slate-500 hover:text-white hover:border-white/20'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Módulos */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                      Módulos do setor {setorAtivo}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelecionados(new Set(MODULOS_GERENCIAVEIS.map(m => m.permission!)))}
                        className="text-[8px] font-black uppercase text-indigo-400 hover:text-indigo-300 cursor-pointer"
                      >
                        Todos
                      </button>
                      <span className="text-slate-700">·</span>
                      <button
                        onClick={() => setSelecionados(new Set())}
                        className="text-[8px] font-black uppercase text-slate-500 hover:text-slate-300 cursor-pointer"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {MODULOS_GERENCIAVEIS.map(mod => {
                      const active = selecionados.has(mod.permission!);
                      return (
                        <button
                          key={mod.id}
                          onClick={() => toggle(mod.permission!)}
                          className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer text-left ${
                            active
                              ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                              : 'bg-white/[0.02] border-white/5 text-slate-500 hover:border-white/10 hover:text-slate-300'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                            active ? 'bg-indigo-600 border-indigo-500' : 'border-white/20 bg-transparent'
                          }`}>
                            {active && <Check size={10} strokeWidth={3} className="text-white" />}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[9px] font-black uppercase tracking-tight truncate">{mod.label}</div>
                            <div className="text-[8px] text-slate-600 truncate">{mod.tag}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Impacto */}
                <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4 flex items-center gap-3">
                  <Users size={16} className="text-slate-500 shrink-0" />
                  <div>
                    <p className="text-[10px] font-black text-white">
                      {afetados} usuário{afetados !== 1 ? 's' : ''} no setor {setorAtivo}
                    </p>
                    <p className="text-[8px] text-slate-600">
                      Ao salvar, todos herdarão estas permissões automaticamente.
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex gap-3 px-6 py-4 border-t border-white/5">
                <button
                  onClick={onClose}
                  className="flex-1 h-10 rounded-xl border border-white/10 text-[10px] font-black uppercase text-slate-500 hover:text-white hover:border-white/20 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvar}
                  disabled={isPending}
                  className="flex-[2] h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Salvar Atribuições
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
