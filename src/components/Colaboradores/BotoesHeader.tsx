"use client";

import { useState } from "react";
import { Plus, UserPlus } from "lucide-react";
import { ModalAdicionarColaborador } from "@/app/PainelAlpha/AlphaVault/AdicionarColaborador/ModalAdicionarColaborador";
import { ModalAdicionarSistema } from "@/app/PainelAlpha/AlphaVault/AdicionarSistema/ModalAdicionarSistema";


export function BotoesHeader({ style }: { style: any }) {
  const [modalColabAberto, setModalColabAberto] = useState(false);
  const [modalSistemaAberto, setModalSistemaAberto] = useState(false); 

  return (
    <>
      <div className="flex items-center gap-3">


        <button 
          onClick={() => setModalSistemaAberto(true)} 
          className="cursor-pointer h-14 px-6 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95 group"
          >
          <Plus size={18} className={style.text} /> Adicionar Sistema
        </button>

        <button 
          onClick={() => setModalColabAberto(true)}
          className={`cursor-pointer h-14 px-8 ${style.bg} rounded-2xl flex items-center gap-3 text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all active:scale-95 shadow-2xl ${style.glow?.replace('blur', '')}`}
          >
          <UserPlus size={18} /> Adicionar Colaborador
        </button>
      </div>

      <ModalAdicionarColaborador 
        isOpen={modalColabAberto} 
        onClose={() => setModalColabAberto(false)} 
        style={style} 
      />

      <ModalAdicionarSistema 
        isOpen={modalSistemaAberto} 
        onClose={() => setModalSistemaAberto(false)} 
        style={style} 
      />
    </>
  );
}
