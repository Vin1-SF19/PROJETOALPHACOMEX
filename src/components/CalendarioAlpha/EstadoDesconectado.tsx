"use client";

import { useTransition } from "react";
import { CalendarClock, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { ativarCalendarioAlpha } from "@/actions/google-calendar-conexao";
import { cn } from "@/lib/utils";
import type { TemaAlpha } from "@/lib/temas";

export function EstadoDesconectado({
  tema,
  emailUsuario,
  onAtivado,
}: {
  tema: TemaAlpha;
  emailUsuario?: string;
  onAtivado: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function ativar() {
    startTransition(async () => {
      const resultado = await ativarCalendarioAlpha();
      if (!resultado.success) {
        toast.error(resultado.error ?? "Não foi possível ativar a Agenda Alpha agora.");
        return;
      }
      toast.success("Agenda Alpha ativada.");
      onAtivado();
    });
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-[2.5rem] border border-white/5 bg-white/[0.02] p-8 sm:p-10 backdrop-blur-xl shadow-2xl">
        <div className="flex items-center gap-4 mb-6">
          <div className={cn("p-3.5 rounded-2xl border border-white/5 bg-white/5", tema.glow)}>
            <CalendarClock className={cn("w-7 h-7", tema.text)} />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase italic tracking-tighter text-white">Agenda Alpha</h1>
            <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500 font-bold">Sua agenda Google, dentro do Painel</p>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed mb-5">
          O acesso à sua agenda Google Workspace{emailUsuario ? ` (${emailUsuario})` : ""} já foi autorizado pela
          TI da empresa. Basta ativar o módulo para começar a ver e gerenciar seus compromissos aqui — o login do
          Painel continua exatamente igual.
        </p>

        <div className="rounded-2xl border border-white/5 bg-black/20 p-4 mb-6">
          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-2">O que é acessado</p>
          <ul className="space-y-1.5 text-sm text-slate-400">
            <li>• Lista dos seus calendários Google e dos eventos que você escolher exibir</li>
            <li>• Criação, edição e cancelamento apenas dos calendários que você marcar como graváveis</li>
            <li>• Disponibilidade (livre/ocupado), sem expor título ou detalhe de eventos privados</li>
          </ul>
        </div>

        <button
          type="button"
          onClick={ativar}
          disabled={isPending}
          className={cn(
            "flex items-center justify-center gap-2.5 w-full rounded-2xl px-5 py-3.5 text-sm font-black uppercase tracking-wide text-white transition-transform hover:scale-[1.02] active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none",
            tema.bg,
          )}
        >
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Ativar Agenda Alpha
        </button>

        <div className="flex items-start gap-2 mt-4 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Você pode desativar quando quiser. Desativar não remove o acesso concedido pela empresa, só para de usar o módulo aqui no Painel.</span>
        </div>
      </div>
    </div>
  );
}
