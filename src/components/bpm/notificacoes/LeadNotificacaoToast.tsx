"use client";
import { Globe, Instagram, Users, X } from "lucide-react";
import { detalhesAlertaLeadBpm, type AlertaLeadBpm } from "@/lib/bpm/notificacoes-leads";
import { cn } from "@/lib/utils";

export const corNotificacaoLead = (origem: AlertaLeadBpm["origem"]) =>
  origem === "INSTAGRAM" ? "#a78bfa" : origem === "SITE" ? "#60a5fa" : "#94a3b8";

interface LeadNotificacaoToastProps { alerta: AlertaLeadBpm; onAbrir: () => void; onFechar: () => void }
export function LeadNotificacaoToast({ alerta, onAbrir, onFechar }: LeadNotificacaoToastProps) {
  const Icone = alerta.origem === "INSTAGRAM" ? Instagram : alerta.origem === "SITE" ? Globe : Users;
  return <div className={cn("flex w-full max-w-[calc(100vw-2rem)] items-start gap-3 rounded-xl border p-4 shadow-xl",
    alerta.origem === "INSTAGRAM" ? "border-violet-400/40 bg-violet-950 text-violet-50"
      : alerta.origem === "SITE" ? "border-blue-400/40 bg-blue-950 text-blue-50" : "border-slate-600 bg-slate-900 text-slate-100")}>
    <Icone className="mt-1 size-5 shrink-0" aria-hidden="true" />
    <button type="button" onClick={onAbrir} className="min-w-0 flex-1 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current">
      <span className="block text-xs font-medium">Novo lead · {alerta.origem === "INSTAGRAM" ? "Instagram" : alerta.origem === "SITE" ? "Site" : alerta.pipelineNome}</span>
      <span className="mt-1 block break-words text-sm font-semibold">{alerta.nome}</span>
      <span className="mt-2 block whitespace-pre-wrap break-words text-xs leading-relaxed">{detalhesAlertaLeadBpm(alerta)}</span>
      <span className="mt-3 block text-xs font-semibold underline underline-offset-4">Abrir lead</span>
    </button>
    <button type="button" aria-label="Fechar aviso do lead" title="O lead permanece na central até alguém assumir" onClick={onFechar}
      className="shrink-0 rounded p-1 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"><X className="size-4" /></button>
  </div>;
}
