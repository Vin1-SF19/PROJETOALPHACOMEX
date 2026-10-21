"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { User, Mail, Lock, KeyRound, ShieldCheck } from "lucide-react";
import { SETOR_LIDER_COMERCIAL } from "@/lib/setores-catalogo";

type EditionUserProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: number;
    nome?: string;
    usuario?: string;
    email?: string;
    role?: string;
    imagemUrl?: string | null;
  } | null;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
};

const SETORES_LISTA = [
  { value: "Admin",             label: "TI.ADMINISTRADOR" },
  { value: "CEO",               label: "CEO" },
  { value: "OPERACIONAL",       label: "OPERACIONAL" },
  { value: "COMERCIAL",         label: "COMERCIAL" },
  { value: SETOR_LIDER_COMERCIAL, label: "LÍDER COMERCIAL" },
  { value: "RECURSOS HUMANOS",  label: "RECURSOS HUMANOS" },
  { value: "FINANCEIRO",        label: "FINANCEIRO" },
  { value: "JURÍDICO",          label: "JURÍDICO" },
  { value: "PARCEIRO",          label: "PARCEIRO" },
  { value: "Serviços Gerais",   label: "SERVIÇOS GERAIS" },
];

export default function EditionUser({ open, onOpenChange, user, onSubmit }: EditionUserProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-slate-950 text-white border-white/5 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] max-h-[90vh] overflow-y-auto custom-scrollbar">

        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600/10 border border-indigo-500/20 shadow-inner">
              <User className="text-indigo-400 w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Editar Colaborador</DialogTitle>
              <DialogDescription className="text-slate-500 text-xs font-medium uppercase tracking-wider">
                ID: {String(user?.id ?? '').substring(0, 8)}... · {user?.usuario}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {user && (
          <form onSubmit={onSubmit} className="space-y-6 py-4">

            {/* Identificação */}
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Nome Completo</Label>
                <div className="relative">
                  <Input name="nome" defaultValue={user.nome} className="pl-10 bg-slate-900/50 border-white/5 h-11 focus:ring-2 focus:ring-indigo-600/50 rounded-xl" />
                  <User className="absolute left-3 top-3 text-slate-600" size={18} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Username</Label>
                  <div className="relative">
                    <Input name="usuario" defaultValue={user.usuario} className="pl-10 bg-slate-900/50 border-white/5 h-11 focus:ring-2 focus:ring-indigo-600/50 rounded-xl" />
                    <KeyRound className="absolute left-3 top-3 text-slate-600" size={18} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label className="text-[10px] uppercase font-bold text-slate-400 ml-1">E-mail</Label>
                  <div className="relative">
                    <Input name="email" defaultValue={user.email} className="pl-10 bg-slate-900/50 border-white/5 h-11 focus:ring-2 focus:ring-indigo-600/50 rounded-xl" />
                    <Mail className="absolute left-3 top-3 text-slate-600" size={18} />
                  </div>
                </div>
              </div>
            </div>

            {/* Setor */}
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-amber-400 ml-1 flex items-center gap-1.5">
                <ShieldCheck size={12} /> Setor / Hierarquia
              </Label>
              <Select name="role" defaultValue={user.role || "User"}>
                <SelectTrigger className="bg-slate-900/50 border-white/5 h-11 rounded-xl focus:ring-2 focus:ring-indigo-600/50">
                  <SelectValue placeholder="Definir Setor" />
                </SelectTrigger>
                <SelectContent className="bg-slate-950 border-white/10 text-white">
                  {SETORES_LISTA.map(s => (
                    <SelectItem key={s.value} value={s.value} className="focus:bg-indigo-600 focus:text-white transition-colors py-2.5">
                      <span className="text-[10px] font-bold tracking-widest uppercase">{s.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[8px] text-slate-600 font-bold px-1">
                Módulos são herdados automaticamente do setor. Para overrides individuais, use o botão &quot;Permissões&quot; na listagem.
              </p>
            </div>

            {/* Senha */}
            <div className="pt-2 border-t border-white/5">
              <div className="grid gap-2">
                <Label className="text-[10px] uppercase font-bold text-slate-400 ml-1">Nova Senha (Opcional)</Label>
                <div className="relative">
                  <Input name="senha" type="password" placeholder="••••••••••••" className="pl-10 bg-slate-900/50 border-white/5 h-11 focus:ring-2 focus:ring-indigo-600/50 rounded-xl" />
                  <Lock className="absolute left-3 top-3 text-slate-600" size={18} />
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="cursor-pointer flex-1 h-12 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10">
                Descartar
              </Button>
              <Button type="submit" className="cursor-pointer flex-[2] h-12 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl shadow-xl shadow-indigo-900/40 transition-all active:scale-95">
                Atualizar Perfil
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
