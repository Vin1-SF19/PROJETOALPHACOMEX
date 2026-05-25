"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Lock, Eye, EyeOff, ShieldCheck, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { trocarSenhaObrigatoria } from "@/actions/onboarding";

export default function MudarSenhaForm() {
  const router = useRouter();
  const { update } = useSession();
  const [isPending, startTransition] = useTransition();
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [mostrar, setMostrar] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (novaSenha.length < 6) {
      toast.error("Senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (novaSenha !== confirmar) {
      toast.error("Senhas não coincidem");
      return;
    }

    startTransition(async () => {
      const res = await trocarSenhaObrigatoria(novaSenha);
      if (res.success) {
        toast.success("Senha definida com sucesso! Bem-vindo ao Painel Alpha.");
        await update({ senhaTemporaria: false });
        router.push("/PainelAlpha");
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro ao alterar senha");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">
          Nova Senha
        </Label>
        <div className="relative group">
          <Input
            type={mostrar ? "text" : "password"}
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            className="h-13 bg-black/40 border-white/5 rounded-2xl pl-10 pr-10 focus:border-indigo-500/50 font-mono"
            required
            minLength={6}
          />
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-500 transition-colors" size={16} />
          <button
            type="button"
            onClick={() => setMostrar((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
          >
            {mostrar ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">
          Confirmar Senha
        </Label>
        <div className="relative group">
          <Input
            type={mostrar ? "text" : "password"}
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            placeholder="Repita a senha"
            className="h-13 bg-black/40 border-white/5 rounded-2xl pl-10 focus:border-indigo-500/50 font-mono"
            required
          />
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-500 transition-colors" size={16} />
        </div>
        {confirmar && novaSenha !== confirmar && (
          <p className="text-[9px] text-rose-500 font-bold ml-1">Senhas não coincidem</p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isPending || !novaSenha || !confirmar || novaSenha !== confirmar}
        className="cursor-pointer w-full h-14 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.4em] rounded-[1.5rem] shadow-2xl shadow-indigo-900/30 transition-all active:scale-95 disabled:opacity-40"
      >
        {isPending ? (
          <LoaderCircle className="animate-spin" />
        ) : (
          <span className="flex items-center gap-2">
            <ShieldCheck size={14} />
            Definir Minha Senha
          </span>
        )}
      </Button>
    </form>
  );
}
