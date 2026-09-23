"use client";

import { useState } from "react";
import { X, Lock, Mail, Check } from "lucide-react";
import { toast } from "sonner";
import { adicionarRecursoVaultAction } from "@/actions/colaboradores";
import type { sistemas_core } from "@prisma/client";
import type { TemaAlpha } from "@/lib/temas";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  agenteId: string;
  sistemas: Pick<sistemas_core, "id" | "nome">[];
  style: TemaAlpha;
}

export function ModalVincularAcesso({ isOpen, onClose, agenteId, sistemas, style }: Props) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.append("colaborador_id", agenteId);

    const res = await adicionarRecursoVaultAction(formData);
    if (res.success) {
      toast.success("ACESSO VINCULADO AO VAULT!");
      onClose();
    } else {
      toast.error(res.error);
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in zoom-in duration-200">
      <div className="bg-[#0f172a] border border-white/10 p-8 rounded-[2.5rem] max-w-sm w-full shadow-2xl relative">
        <div className={`absolute top-0 left-0 w-full h-1 ${style.bg}`} />
        <button onClick={onClose} className="absolute top-6 right-6 text-slate-500 hover:text-white"><X size={20} /></button>
        
        <h2 className="text-lg font-black uppercase italic tracking-tighter text-white mb-6 flex items-center gap-3">
          <Lock className={style.text} size={20} /> Novo Acesso
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Sistema Alvo</label>
            <select name="sistema_id" required className="w-full bg-black/40 border border-white/5 rounded-xl h-12 px-4 text-[10px] font-black uppercase text-white outline-none">
              <option value="">SELECIONE O SISTEMA...</option>
              {sistemas.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[9px] font-black uppercase text-slate-500 ml-1">E-mail / Login</label>
            <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                <input name="login" required placeholder="USUARIO@ALPHA.COM" className="w-full bg-black/40 border border-white/5 rounded-xl h-12 pl-10 pr-4 text-[10px] font-black text-white outline-none" />
            </div>
          </div>

          <div>
            <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Senha de Acesso</label>
            <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                <input name="senha" type="text" required placeholder="DIGITE A SENHA..." className="w-full bg-black/40 border border-white/5 rounded-xl h-12 pl-10 pr-4 text-[10px] font-black text-white outline-none" />
            </div>
          </div>

          <button type="submit" disabled={loading} className={`w-full h-14 mt-2 ${style.bg} rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-3 hover:brightness-110 transition-all active:scale-95`}>
            {loading ? <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={18} />}
            Confirmar Acesso
          </button>
        </form>
      </div>
    </div>
  );
}
