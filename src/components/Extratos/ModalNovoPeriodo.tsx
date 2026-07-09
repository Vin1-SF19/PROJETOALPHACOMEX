"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, ChevronDown, Hash, Layers } from "lucide-react";
import { modalVariants, MODAL_PERSPECTIVE } from "./lib/modal-variants";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const ANOS = Array.from({ length: 11 }, (_, i) => (2020 + i).toString());

interface ModalNovoPeriodoProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dados: { mes: string; ano: string }) => void;
}

export function ModalNovoPeriodo({ isOpen, onClose, onSave }: ModalNovoPeriodoProps) {
  const [tipoRegistro, setTipoRegistro] = useState<"mensal" | "anual">("mensal");
  const [mes, setMes] = useState(MESES[new Date().getMonth()]);
  const [ano, setAno] = useState(new Date().getFullYear().toString());

  const handleSave = () => {
    if (tipoRegistro === "anual") {
      onSave({ mes: "Ano de referencia", ano });
    } else {
      onSave({ mes, ano });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" style={{ perspective: MODAL_PERSPECTIVE }}>
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        style={{ transformStyle: "preserve-3d" }}
        className="bg-[#0f172a] border border-white/10 w-full max-w-md rounded-[3rem] overflow-hidden shadow-2xl relative"
      >
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r transition-all duration-500 ${tipoRegistro === "mensal" ? "from-indigo-500 via-purple-500 to-indigo-500" : "from-emerald-500 via-teal-500 to-emerald-500"}`} />

        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-2xl flex items-center justify-center transition-colors ${tipoRegistro === "mensal" ? "bg-indigo-500/10 text-indigo-400" : "bg-emerald-500/10 text-emerald-400"}`}>
              {tipoRegistro === "mensal" ? <Calendar size={20} aria-hidden="true" /> : <Layers size={20} aria-hidden="true" />}
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter leading-none">Novo Ciclo</h2>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">Configuração de Referência</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="h-10 w-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/5 transition-all">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="p-8 space-y-8">
          <div className="flex p-1 bg-black/40 rounded-2xl border border-white/5">
            <button
              onClick={() => setTipoRegistro("mensal")}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tipoRegistro === "mensal" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40" : "text-slate-500 hover:text-slate-300"}`}
            >
              Mensal
            </button>
            <button
              onClick={() => setTipoRegistro("anual")}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tipoRegistro === "anual" ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40" : "text-slate-500 hover:text-slate-300"}`}
            >
              Anual
            </button>
          </div>

          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {tipoRegistro === "mensal" ? (
                <motion.div key="mensal" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="grid grid-cols-1 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="periodo-mes" className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] ml-2 font-mono">Mês</label>
                    <div className="relative">
                      <select
                        id="periodo-mes"
                        value={mes}
                        onChange={(e) => setMes(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-indigo-500/50 uppercase font-bold appearance-none cursor-pointer hover:bg-white/[0.07] transition-all"
                      >
                        {MESES.map((m) => <option key={m} value={m} className="bg-[#0f172a] text-white">{m}</option>)}
                      </select>
                      <ChevronDown size={16} aria-hidden="true" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="periodo-ano" className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] ml-2 font-mono">Ano</label>
                    <div className="relative">
                      <select
                        id="periodo-ano"
                        value={ano}
                        onChange={(e) => setAno(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-indigo-500/50 uppercase font-bold appearance-none cursor-pointer hover:bg-white/[0.07] transition-all"
                      >
                        {ANOS.map((a) => <option key={a} value={a} className="bg-[#0f172a] text-white">{a}</option>)}
                      </select>
                      <ChevronDown size={16} aria-hidden="true" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="anual" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                  <div className="p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-[2rem] text-center">
                    <Hash aria-hidden="true" className="mx-auto mb-3 text-emerald-400 opacity-50" size={32} />
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Modo Relatório Anual Ativo</p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="periodo-ano-anual" className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] ml-2 font-mono">Ano de Referência</label>
                    <div className="relative">
                      <select
                        id="periodo-ano-anual"
                        value={ano}
                        onChange={(e) => setAno(e.target.value)}
                        className="w-full bg-white/5 border border-emerald-500/20 rounded-2xl p-6 text-white text-xl outline-none focus:border-emerald-500/50 uppercase font-black text-center appearance-none cursor-pointer hover:bg-white/[0.07] transition-all tracking-[0.2em]"
                      >
                        {ANOS.map((a) => <option key={a} value={a} className="bg-[#0f172a] text-white">{a}</option>)}
                      </select>
                      <ChevronDown size={20} aria-hidden="true" className="absolute right-6 top-1/2 -translate-y-1/2 text-emerald-500/50 pointer-events-none" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={handleSave}
            className={`cursor-pointer w-full group relative flex items-center justify-center gap-3 py-5 text-white rounded-[2rem] text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-xl active:scale-[0.98] ${tipoRegistro === "mensal" ? "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/40" : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/40"}`}
          >
            Confirmar e Criar Ciclo {tipoRegistro === "anual" ? "Anual" : "Mensal"}
          </button>

          <p className="text-center text-[9px] text-slate-600 font-bold uppercase tracking-widest italic leading-relaxed">
            {tipoRegistro === "mensal"
              ? "Vincule extratos mensais específicos a este período."
              : "Ideal para balanços consolidados e extratos anuais."}
          </p>
        </div>
      </motion.div>
    </div>
      )}
    </AnimatePresence>
  );
}
