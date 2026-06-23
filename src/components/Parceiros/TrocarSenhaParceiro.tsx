"use client";

import { useState } from "react";
import { KeyRound, Loader2, Eye, EyeOff, Wand2, Copy, Check, X } from "lucide-react";
import { toast } from "sonner";
import { redefinirSenhaParceiro } from "@/actions/parceiros";

function gerarSenha(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function TrocarSenhaParceiro({ parceiroId }: { parceiroId: number }) {
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const reset = () => {
    setSenha("");
    setMostrar(false);
    setCopiado(false);
  };

  const fechar = () => {
    setAberto(false);
    reset();
  };

  const gerar = () => {
    const nova = gerarSenha();
    setSenha(nova);
    setMostrar(true);
  };

  const copiar = async () => {
    if (!senha) return;
    try {
      await navigator.clipboard.writeText(senha);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const salvar = async () => {
    if (senha.trim().length < 6) {
      toast.error("A senha deve ter ao menos 6 caracteres");
      return;
    }
    setSalvando(true);
    const res = await redefinirSenhaParceiro(parceiroId, senha.trim());
    setSalvando(false);
    if (!res.success) {
      toast.error(res.error ?? "Erro ao redefinir a senha");
      return;
    }
    toast.success("Senha redefinida! O parceiro definirá uma própria no próximo acesso.");
    fechar();
  };

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:border-indigo-500/40 text-[10px] font-black uppercase tracking-widest transition-all"
      >
        <KeyRound size={13} /> Trocar senha
      </button>
    );
  }

  return (
    <div className="mt-3 p-3.5 rounded-2xl bg-black/30 border border-indigo-500/20">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 flex items-center gap-1.5">
          <KeyRound size={12} /> Redefinir senha (Admin)
        </span>
        <button type="button" onClick={fechar} className="text-slate-500 hover:text-white">
          <X size={15} />
        </button>
      </div>

      <div className="relative">
        <input
          type={mostrar ? "text" : "password"}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Nova senha (mín. 6 caracteres)"
          className="w-full h-11 rounded-xl bg-white/5 border border-white/10 pl-3.5 pr-20 text-[13px] text-white placeholder:text-slate-600 focus:border-indigo-500/50 outline-none transition-all"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {senha && (
            <button type="button" onClick={copiar} className="text-slate-500 hover:text-white" title="Copiar">
              {copiado ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
            </button>
          )}
          <button type="button" onClick={() => setMostrar((m) => !m)} className="text-slate-500 hover:text-white">
            {mostrar ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2.5">
        <button
          type="button"
          onClick={gerar}
          className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white text-[10px] font-black uppercase tracking-widest"
        >
          <Wand2 size={13} /> Gerar
        </button>
        <button
          type="button"
          onClick={salvar}
          disabled={salvando || senha.trim().length < 6}
          className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
        >
          {salvando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Salvar
        </button>
      </div>

      <p className="text-[9px] text-slate-600 italic mt-2 leading-relaxed">
        A senha entra como temporária — o parceiro será solicitado a criar a própria no próximo login.
      </p>
    </div>
  );
}
