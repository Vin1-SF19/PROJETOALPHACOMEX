"use client";

import { CheckCircle2, Plus, Sparkles } from "lucide-react";

import type { TemaAlpha } from "@/lib/temas";
import { cn } from "@/lib/utils";

import { DetalhePopover } from "./DetalhePopover";
import { DiaEventosPopover } from "./DiaEventosPopover";
import { agruparPorDia, diasDoGridMes, formatarDataCivil, mesmodia } from "./lib/datas";
import { corDoItemAgenda, type EventoExibicao } from "./lib/tipos";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function VisaoMes({
  dataReferencia,
  eventos,
  tema,
  onEditarEvento,
  onEventoCancelado,
  onSelecionarDia,
  onNovoEventoNoDia,
  onConcluirTarefa,
}: {
  dataReferencia: Date;
  eventos: EventoExibicao[];
  tema: TemaAlpha;
  onEditarEvento: (evento: EventoExibicao) => void;
  onEventoCancelado: () => void;
  onSelecionarDia: (data: Date) => void;
  onNovoEventoNoDia: (data: Date) => void;
  onConcluirTarefa: (tarefaCacheId: string) => void;
}) {
  const dias = diasDoGridMes(dataReferencia);
  const eventosPorDia = agruparPorDia(eventos);
  const hoje = new Date();
  const mesReferenciaCivil = formatarDataCivil(dataReferencia).slice(0, 7);

  const limiteEventosVisiveis = 3;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_33%),linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] shadow-2xl shadow-slate-950/20">
      <div className="grid shrink-0 grid-cols-7 border-b border-white/10 bg-slate-950/20">
        {DIAS_SEMANA.map((dia) => (
          <div key={dia} className="px-2 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
            {dia}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
        {dias.map((dia) => {
          const chave = formatarDataCivil(dia);
          const eventosDoDia = eventosPorDia.get(chave) ?? [];
          const foraDoMes = chave.slice(0, 7) !== mesReferenciaCivil;
          const ehHoje = mesmodia(dia, hoje);

          return (
            <div
              key={chave}
              role="button"
              tabIndex={0}
              onClick={() => onSelecionarDia(dia)}
              onKeyDown={(evento) => {
                if (evento.key === "Enter" || evento.key === " ") {
                  evento.preventDefault();
                  onSelecionarDia(dia);
                }
              }}
              aria-label={`Ver ${dia.toLocaleDateString("pt-BR")}${eventosDoDia.length ? `, ${eventosDoDia.length} evento(s)` : ""}`}
              className={cn(
                "group relative min-h-0 overflow-hidden border-b border-r border-white/[0.07] p-1 sm:p-1.5 xl:p-2 text-left align-top transition-all duration-200 hover:z-10 hover:bg-white/[0.055] hover:shadow-[inset_0_0_28px_rgba(255,255,255,0.035)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/30",
                foraDoMes && "opacity-30",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "inline-flex h-7 w-7 items-center justify-center rounded-xl text-xs font-bold text-slate-300 transition-transform group-hover:scale-105",
                    ehHoje && "bg-white text-slate-950 shadow-lg shadow-white/20",
                  )}
                >
                  {Number(chave.slice(8, 10))}
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onNovoEventoNoDia(dia);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      e.preventDefault();
                      onNovoEventoNoDia(dia);
                    }
                  }}
                  aria-label={`Novo evento em ${dia.toLocaleDateString("pt-BR")}`}
                  title="Novo evento"
                  className="flex h-5 w-5 items-center justify-center rounded-md text-slate-500 opacity-0 transition-opacity hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Plus className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-1.5 space-y-1">
                {eventosDoDia.slice(0, limiteEventosVisiveis).map((evento) => evento.tipo === "tarefa" ? (
                  <div key={evento.id} className="group/task relative flex w-full items-center gap-1 overflow-hidden rounded-lg border border-white/15 py-1 pr-1 text-[10px] font-bold text-white shadow-[0_5px_14px_rgba(15,23,42,0.22)] transition-all hover:-translate-y-px hover:brightness-110 hover:shadow-[0_7px_18px_rgba(15,23,42,0.3)]" style={{ borderLeftColor: corDoItemAgenda(evento), borderLeftWidth: 3, background: `linear-gradient(135deg, ${corDoItemAgenda(evento)}f2, ${corDoItemAgenda(evento)}b8)` }}>
                    {evento.status === "completed" ? (
                      <span className="ml-1 flex size-4 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/20" title="Tarefa concluída"><CheckCircle2 className="size-3 text-white" aria-hidden="true" /></span>
                    ) : (
                      <button type="button" onClick={(e) => { e.stopPropagation(); if (evento.tarefaCacheId) onConcluirTarefa(evento.tarefaCacheId); }} className="ml-1 flex size-4 shrink-0 items-center justify-center rounded-full border border-white/80 bg-slate-950/25 transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label={`Concluir tarefa: ${evento.titulo || "sem título"}`} title="Concluir tarefa">
                        <CheckCircle2 className="size-3 text-white" aria-hidden="true" />
                      </button>
                    )}
                    <button type="button" onClick={(e) => { e.stopPropagation(); onEditarEvento(evento); }} className="min-w-0 flex-1 truncate px-0.5 text-left focus:outline-none" title={`Editar tarefa: ${evento.titulo || "sem título"}`}>
                      {evento.titulo || "(sem título)"}
                    </button>
                  </div>
                ) : (
                  <DetalhePopover key={evento.id} evento={evento} tema={tema} onEditar={onEditarEvento} onCancelado={onEventoCancelado}>
                    <button type="button" onClick={(e) => e.stopPropagation()} className={cn("group/event relative flex w-full items-center gap-1.5 overflow-hidden rounded-lg border border-white/10 px-1.5 py-1 text-left text-[10px] font-bold text-white shadow-[0_5px_14px_rgba(15,23,42,0.18)] transition-all before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent before:opacity-70 hover:-translate-y-px hover:brightness-110 hover:shadow-lg", evento.recusadoPeloUsuario && "opacity-55 grayscale line-through") } style={{ background: `linear-gradient(135deg, ${corDoItemAgenda(evento)}f2, ${corDoItemAgenda(evento)}b8)`, borderLeftColor: "rgba(255,255,255,0.75)", borderLeftWidth: 3 }} title={evento.recusadoPeloUsuario ? `${evento.titulo ?? "(sem título)"} — convite recusado` : evento.titulo ?? "(sem título)"}>
                      {evento.eventType === "focusTime" && <Sparkles className="size-3 shrink-0 text-white/90" aria-hidden="true" />}
                      <span className="truncate">{evento.titulo || "(sem título)"}</span>
                    </button>
                  </DetalhePopover>
                ))}
                {eventosDoDia.length > limiteEventosVisiveis && (
                  <DiaEventosPopover dia={dia} eventos={eventosDoDia} onEditarEvento={onEditarEvento} onConcluirTarefa={onConcluirTarefa}>
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className="block w-full rounded-md px-1.5 py-0.5 text-left text-[10px] font-semibold text-slate-400 hover:text-white hover:bg-white/5"
                    >
                      +{eventosDoDia.length - limiteEventosVisiveis} mais
                    </button>
                  </DiaEventosPopover>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
