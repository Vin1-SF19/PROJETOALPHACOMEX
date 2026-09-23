"use client";

import { useState } from "react";
import { User, ShieldCheck, Calendar, ArrowRight } from "lucide-react";
import { getTema } from "@/lib/temas";
import { ModalEditarAgente } from "../EditarColaborador/ModalEditarAgente";
import type { ColaboradorVault, RecursoVault, SistemaVault } from "../types";

interface CardAgenteProps {
  colab: ColaboradorVault;
  sistemas: SistemaVault[];
  recursos: RecursoVault[];
}

export function CardAgente({ colab, sistemas, recursos }: CardAgenteProps) {
  const [modalAberto, setModalAberto] = useState(false);
  const colabStyle = getTema(colab.tema_interface || "blue");
  const isAtivo = colab.status === "ATIVO";

  return (
    <>
      <div className="bg-slate-900/60 border border-white/5 rounded-[2.5rem] p-1 group hover:border-white/10 transition-all shadow-lg hover:shadow-black/50">
        <div className="bg-[#0f172a] rounded-[2.3rem] p-6 relative overflow-hidden">
          <div className="absolute top-6 right-6 flex gap-2">
            <div className="px-3 py-1 rounded-full text-[7px] font-black uppercase tracking-tighter border bg-white/5 text-slate-400 border-white/10">
              {colab.tipo}
            </div>
            <div className={`px-3 py-1 rounded-full text-[7px] font-black uppercase tracking-tighter border ${isAtivo ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
              {colab.status}
            </div>
          </div>

          <div className="flex items-center gap-4 mb-8">
            <div className={`h-16 w-16 rounded-2xl ${colabStyle.bg} flex items-center justify-center shadow-2xl shadow-black transition-all duration-500 group-hover:scale-110`}>
              <User size={32} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight">{colab.nome}</h3>
              <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${colabStyle.text}`}>{colab.cargo || "AGENTE ALPHA"}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-black/20 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-slate-500" />
                <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Setor</span>
              </div>
              <span className="text-[9px] font-black uppercase">{colab.role}</span>
            </div>

            <div className="flex items-center justify-between p-3 bg-black/20 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-slate-500" />
                <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Contratação</span>
              </div>
              <span className="text-[9px] font-black uppercase">{colab.data_contratacao || "---"}</span>
            </div>
          </div>

          <button 
            onClick={() => setModalAberto(true)}
            className={`w-full mt-6 h-14 rounded-2xl border border-white/5 bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 active:scale-95 group/btn`}
          >
            Acessar Recursos <ArrowRight size={14} className={`group-hover/btn:translate-x-1 transition-transform ${colabStyle.text}`} />
          </button>
        </div>
      </div>

      <ModalEditarAgente 
        isOpen={modalAberto} 
        onClose={() => setModalAberto(false)} 
        agente={colab}
        style={colabStyle}
        sistemas={sistemas}
        recursos={recursos}
      />
    </>
  );
}
