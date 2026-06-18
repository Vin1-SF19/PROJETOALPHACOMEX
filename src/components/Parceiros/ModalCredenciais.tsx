"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Copy, Eye, EyeOff, KeyRound, Mail, Sparkles } from "lucide-react";
import { toast } from "sonner";

type TemplateOnboarding = {
  id: number;
  nome: string;
  mensagem: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  loginEmail: string;
  senhaGerada: string;
  nomeParceiro: string;
  template?: TemplateOnboarding | null;
};

function substituir(texto: string, login: string, senha: string): string {
  return texto
    .replace(/\{login\}/g, login)
    .replace(/\{senha\}/g, senha)
    .replace(/\[LOGIN\]/g, login)
    .replace(/\[SENHA\]/g, senha);
}

export default function ModalCredenciais({ open, onClose, loginEmail, senhaGerada, nomeParceiro, template }: Props) {
  const [copiouSenha, setCopiouSenha] = useState(false);
  const [copiouLogin, setCopiouLogin] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  async function copiar(texto: string, tipo: "login" | "senha") {
    await navigator.clipboard.writeText(texto);
    if (tipo === "senha") { setCopiouSenha(true); setTimeout(() => setCopiouSenha(false), 2000); }
    else { setCopiouLogin(true); setTimeout(() => setCopiouLogin(false), 2000); }
    toast.success(`${tipo === "senha" ? "Senha" : "Login"} copiado!`);
  }

  const mensagemFinal = template
    ? substituir(template.mensagem, loginEmail, senhaGerada)
    : `Bem-vindo ao sistema de parceiros, ${nomeParceiro}!\n\nSeu acesso:\nLogin: ${loginEmail}\nSenha: ${senhaGerada}\n\nGuarde estas informações com segurança.`;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-slate-950 border-white/10 text-slate-200 max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white font-black uppercase italic tracking-tight">
            <Sparkles size={18} className="text-amber-400" />
            Parceiro Cadastrado!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-xs text-slate-400 leading-relaxed">
            Parceiro <span className="text-white font-black">{nomeParceiro}</span> cadastrado com sucesso.
            Compartilhe as credenciais de acesso abaixo — a senha só é exibida <span className="text-amber-400 font-bold">uma vez</span>.
          </p>

          {/* Login */}
          <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1">
              <Mail size={10} /> Login
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-mono text-white">{loginEmail}</span>
              <Button type="button" size="sm" variant="ghost"
                onClick={() => copiar(loginEmail, "login")}
                className="h-7 w-7 p-0 text-slate-400 hover:text-white">
                {copiouLogin ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              </Button>
            </div>
          </div>

          {/* Senha */}
          <div className="bg-black/40 border border-amber-500/30 rounded-2xl p-4 space-y-1">
            <span className="text-[10px] font-black uppercase text-amber-500 tracking-widest flex items-center gap-1">
              <KeyRound size={10} /> Senha (exibida apenas agora)
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-mono text-white flex-1 break-all">
                {mostrarSenha ? senhaGerada : "•".repeat(senhaGerada.length)}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <Button type="button" size="sm" variant="ghost"
                  onClick={() => setMostrarSenha(v => !v)}
                  className="h-7 w-7 p-0 text-slate-400 hover:text-white">
                  {mostrarSenha ? <EyeOff size={13} /> : <Eye size={13} />}
                </Button>
                <Button type="button" size="sm" variant="ghost"
                  onClick={() => copiar(senhaGerada, "senha")}
                  className="h-7 w-7 p-0 text-slate-400 hover:text-white">
                  {copiouSenha ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </Button>
              </div>
            </div>
          </div>

          {/* Mensagem configurável */}
          {template && (
            <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">
                Mensagem de Boas-vindas
              </p>
              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{mensagemFinal}</p>
              <Button type="button" size="sm" variant="ghost"
                onClick={() => { navigator.clipboard.writeText(mensagemFinal); toast.success("Mensagem copiada!"); }}
                className="mt-2 h-7 text-[10px] text-slate-400 hover:text-white gap-1 px-2">
                <Copy size={11} /> Copiar mensagem
              </Button>
            </div>
          )}

          <Button type="button" onClick={onClose}
            className="w-full bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black uppercase tracking-widest text-xs h-12">
            Concluir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
