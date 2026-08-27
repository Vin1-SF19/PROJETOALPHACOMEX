"use client";

import { useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { formatarHora, formatarTituloDia } from "./lib/datas";
import { corDoItemAgenda, type EventoExibicao } from "./lib/tipos";

/** Lista completa dos eventos de um dia — aberta ao clicar em "+N mais" na visão de mês. */
export function DiaEventosPopover({
  dia,
  eventos,
  onEditarEvento,
  onConcluirTarefa,
  children,
}: {
  dia: Date;
  eventos: EventoExibicao[];
  onEditarEvento: (evento: EventoExibicao) => void;
  onConcluirTarefa: (tarefaCacheId: string) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-80 border-white/10 bg-slate-950/95 p-0 shadow-2xl shadow-slate-950/60 backdrop-blur-xl">
        <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_60%)] p-4">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400 capitalize">{formatarTituloDia(dia)}</p>
          <p className="mt-1 text-sm font-bold text-white">Compromissos do dia</p>
        </div>
        <div className="max-h-72 space-y-2 overflow-y-auto p-3">
            {eventos.map((evento) => evento.tipo === "tarefa" ? (
              <div key={evento.id} className="group/item relative flex w-full items-start gap-2.5 overflow-hidden rounded-xl border border-white/15 px-3 py-2.5 text-left shadow-[0_6px_18px_rgba(15,23,42,0.2)] transition-all hover:-translate-y-px hover:border-white/30 hover:brightness-110" style={{ borderLeftColor: corDoItemAgenda(evento), borderLeftWidth: 3, background: `linear-gradient(135deg, ${corDoItemAgenda(evento)}e8, ${corDoItemAgenda(evento)}aa)` }}>
                {evento.status === "completed" ? (
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/20" title="Tarefa concluída"><CheckCircle2 className="size-3.5 text-white" aria-hidden="true" /></span>
                ) : (
                  <button type="button" onClick={() => { if (evento.tarefaCacheId) onConcluirTarefa(evento.tarefaCacheId); }} className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-white/80 bg-slate-950/25 transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label={`Concluir tarefa: ${evento.titulo || "sem título"}`} title="Concluir tarefa">
                    <CheckCircle2 className="size-3.5 text-white" aria-hidden="true" />
                  </button>
                )}
                <button type="button" onClick={() => { setOpen(false); onEditarEvento(evento); }} className="min-w-0 flex-1 text-left focus:outline-none">
                  <span className="block truncate text-sm font-bold text-white">{evento.titulo || "(sem título)"}</span>
                  <span className="mt-0.5 block text-[11px] font-medium text-white/75">{evento.diaInteiro ? "Dia inteiro" : evento.inicioEm ? formatarHora(new Date(evento.inicioEm)) : "—"}</span>
                  <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-white/80">{evento.status === "completed" ? "Concluída" : "Clique para editar"}</span>
                </button>
              </div>
            ) : (
              <button
                key={evento.id}
                type="button"
                onClick={() => { setOpen(false); onEditarEvento(evento); }}
                className={evento.recusadoPeloUsuario ? "group/item relative flex w-full items-start gap-2.5 overflow-hidden rounded-xl border border-white/10 px-3 py-2.5 text-left opacity-55 grayscale line-through shadow-[0_6px_18px_rgba(15,23,42,0.2)] transition-all hover:-translate-y-px hover:border-white/20 hover:brightness-110" : "group/item relative flex w-full items-start gap-2.5 overflow-hidden rounded-xl border border-white/10 px-3 py-2.5 text-left shadow-[0_6px_18px_rgba(15,23,42,0.2)] transition-all hover:-translate-y-px hover:border-white/20 hover:brightness-110"}
                style={{ background: `linear-gradient(135deg, ${corDoItemAgenda(evento)}e8, ${corDoItemAgenda(evento)}aa)`, borderLeftColor: "rgba(255,255,255,0.8)", borderLeftWidth: 3 }}
              >
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.8)]" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 truncate text-sm font-bold text-white">
                    {evento.eventType === "focusTime" && <Sparkles className="size-3.5 shrink-0 text-white/90" aria-hidden="true" />}
                    <span className="truncate">{evento.titulo || "(sem título)"}</span>
                  </span>
                  <span className="mt-0.5 block text-[11px] font-medium text-white/70">
                    {evento.diaInteiro ? "Dia inteiro" : evento.inicioEm ? formatarHora(new Date(evento.inicioEm)) : "—"}
                  </span>
                </span>
              </button>
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
