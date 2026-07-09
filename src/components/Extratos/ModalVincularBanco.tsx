"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { X, Info, CheckCircle2 } from "lucide-react";
import { BANCOS_CATALOGO, type BancoCatalogo } from "./lib/bancos-catalogo";
import { modalVariants, MODAL_PERSPECTIVE } from "./lib/modal-variants";

interface ModalVincularBancoProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dados: { bancoSel: BancoCatalogo; descricao: string }) => void;
}

export function ModalVincularBanco({ isOpen, onClose, onSave }: ModalVincularBancoProps) {
  const [bancoSel, setBancoSel] = useState<BancoCatalogo | null>(null);
  const [descricao, setDescricao] = useState("");

  return (
    <AnimatePresence>
      {isOpen && (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" style={{ perspective: MODAL_PERSPECTIVE }}>
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        style={{ transformStyle: "preserve-3d" }}
        className="bg-[#0f172a] border border-white/10 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-[2.5rem] overflow-hidden shadow-2xl"
      >
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
          <div>
            <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Vincular Nova Conta</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Selecione a instituição financeira</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-3 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-all">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 sm:p-8 space-y-8 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {BANCOS_CATALOGO.map((banco) => (
              <button
                key={banco.id}
                onClick={() => setBancoSel(banco)}
                aria-pressed={bancoSel?.id === banco.id}
                className={`cursor-pointer group relative h-32 rounded-3xl border-2 transition-all duration-500 overflow-hidden flex flex-col items-center justify-center gap-3
                  ${bancoSel?.id === banco.id
                    ? "border-indigo-500 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                    : "border-white/5 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]"}`}
              >
                <div className={`relative w-12 h-12 rounded-xl overflow-hidden transition-all duration-500 ${bancoSel?.id === banco.id ? "grayscale-0 scale-110" : "grayscale group-hover:grayscale-[0.5]"}`}>
                  <Image src={banco.logo} alt={banco.nome} fill sizes="48px" className="object-contain" unoptimized />
                </div>

                <span className={`text-[10px] font-black uppercase tracking-widest italic transition-colors duration-300 ${bancoSel?.id === banco.id ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300"}`}>
                  {banco.nome}
                </span>

                {bancoSel?.id === banco.id && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="absolute top-3 right-3 text-indigo-400">
                    <CheckCircle2 size={18} aria-hidden="true" />
                  </motion.div>
                )}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <label htmlFor="banco-descricao" className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">
              <Info size={12} aria-hidden="true" className="text-indigo-500" /> Descrição da Conta
            </label>
            <textarea
              id="banco-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Conta Corrente - Filial Balneário"
              className="w-full bg-white/[0.02] border border-white/10 rounded-2xl p-4 text-2xl text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all resize-none h-24"
            />
          </div>
        </div>

        <div className="p-8 bg-white/[0.02] border-t border-white/5 flex justify-end">
          <button
            onClick={() => bancoSel && onSave({ bancoSel, descricao })}
            className="cursor-pointer px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-900/20 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            disabled={!bancoSel || !descricao}
          >
            Confirmar Vínculo
          </button>
        </div>
      </motion.div>
    </div>
      )}
    </AnimatePresence>
  );
}
