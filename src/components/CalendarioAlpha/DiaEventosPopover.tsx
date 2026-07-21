"use client";

import { useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { formatarHora, formatarTituloDia } from "./lib/datas";
import { COR_CALENDARIO_PADRAO, type EventoExibicao } from "./lib/tipos";

/** Lista completa dos eventos de um dia — aberta ao clicar em "+N mais" na visão de mês. */
export function DiaEventosPopover({
  dia,
  eventos,
  onEditarEvento,
  children,
}: {
  dia: Date;
  eventos: EventoExibicao[];
  onEditarEvento: (evento: EventoExibicao) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-72">
        <div className="p-3 space-y-2">
          <p className="text-xs font-black uppercase tracking-wide text-slate-400 capitalize">{formatarTituloDia(dia)}</p>
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {eventos.map((evento) => (
              <button
                key={evento.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onEditarEvento(evento);
                }}
                className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/5 transition-colors"
              >
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: evento.calendarioCorHex ?? COR_CALENDARIO_PADRAO }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{evento.titulo || "(sem título)"}</span>
                  <span className="block text-[11px] text-slate-500">
                    {evento.diaInteiro ? "Dia inteiro" : evento.inicioEm ? formatarHora(new Date(evento.inicioEm)) : "—"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
