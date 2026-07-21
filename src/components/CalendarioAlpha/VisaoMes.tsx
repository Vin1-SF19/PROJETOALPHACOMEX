"use client";

import { Plus } from "lucide-react";

import type { TemaAlpha } from "@/lib/temas";
import { cn } from "@/lib/utils";

import { DetalhePopover } from "./DetalhePopover";
import { DiaEventosPopover } from "./DiaEventosPopover";
import { agruparPorDia, diasDoGridMes, mesmodia } from "./lib/datas";
import { COR_CALENDARIO_PADRAO, type EventoExibicao } from "./lib/tipos";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function VisaoMes({
  dataReferencia,
  eventos,
  tema,
  onEditarEvento,
  onEventoCancelado,
  onSelecionarDia,
  onNovoEventoNoDia,
}: {
  dataReferencia: Date;
  eventos: EventoExibicao[];
  tema: TemaAlpha;
  onEditarEvento: (evento: EventoExibicao) => void;
  onEventoCancelado: () => void;
  onSelecionarDia: (data: Date) => void;
  onNovoEventoNoDia: (data: Date) => void;
}) {
  const dias = diasDoGridMes(dataReferencia);
  const eventosPorDia = agruparPorDia(eventos);
  const hoje = new Date();

  return (
    <div className="rounded-[2rem] border border-white/5 bg-white/[0.02] overflow-hidden">
      <div className="grid grid-cols-7 border-b border-white/5">
        {DIAS_SEMANA.map((dia) => (
          <div key={dia} className="px-2 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
            {dia}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-fr">
        {dias.map((dia) => {
          const chave = dia.toISOString().slice(0, 10);
          const eventosDoDia = eventosPorDia.get(chave) ?? [];
          const foraDoMes = dia.getMonth() !== dataReferencia.getMonth();
          const ehHoje = mesmodia(dia, hoje);

          return (
            <button
              key={chave}
              type="button"
              onClick={() => onSelecionarDia(dia)}
              aria-label={`Ver ${dia.toLocaleDateString("pt-BR")}${eventosDoDia.length ? `, ${eventosDoDia.length} evento(s)` : ""}`}
              className={cn(
                "group relative min-h-[9rem] sm:min-h-[11rem] border-b border-r border-white/5 p-1.5 sm:p-2.5 text-left align-top transition-colors hover:bg-white/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/30",
                foraDoMes && "opacity-30",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-slate-300",
                    ehHoje && "bg-white text-slate-950",
                  )}
                >
                  {dia.getDate()}
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
              <div className="mt-1 space-y-1">
                {eventosDoDia.slice(0, 5).map((evento) => (
                  <DetalhePopover key={evento.id} evento={evento} tema={tema} onEditar={onEditarEvento} onCancelado={onEventoCancelado}>
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className="block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[10px] font-semibold text-white/90 hover:brightness-110"
                      style={{ backgroundColor: `${evento.calendarioCorHex ?? COR_CALENDARIO_PADRAO}55` }}
                      title={evento.titulo ?? "(sem título)"}
                    >
                      {evento.titulo || "(sem título)"}
                    </button>
                  </DetalhePopover>
                ))}
                {eventosDoDia.length > 5 && (
                  <DiaEventosPopover dia={dia} eventos={eventosDoDia} onEditarEvento={onEditarEvento}>
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className="block w-full rounded-md px-1.5 py-0.5 text-left text-[10px] font-semibold text-slate-400 hover:text-white hover:bg-white/5"
                    >
                      +{eventosDoDia.length - 5} mais
                    </button>
                  </DiaEventosPopover>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
