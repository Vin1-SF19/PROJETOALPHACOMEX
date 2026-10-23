"use client";

import { Compass } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  corOrigemQuadro,
  filtroDoSelectOrigemQuadro,
  TODAS_ORIGENS_QUADRO,
  valorSelectOrigemQuadro,
  type FiltroOrigemQuadro,
} from "@/lib/bpm/origem-quadro";

interface FiltroOrigemBoardProps {
  origens: readonly (string | null)[];
  value: FiltroOrigemQuadro;
  onChange: (origem: FiltroOrigemQuadro) => void;
}

export function FiltroOrigemBoard({ origens, value, onChange }: FiltroOrigemBoardProps) {
  const cor = value === undefined ? null : corOrigemQuadro(value);
  return <Select value={valorSelectOrigemQuadro(value)} onValueChange={(valor) => onChange(filtroDoSelectOrigemQuadro(valor))}>
    <SelectTrigger aria-label="Filtrar cards por origem"
      className="h-11 w-full min-w-0 shrink-0 rounded-xl border-white/15 bg-white/[0.04] px-3 text-sm text-slate-200 transition-colors data-[size=default]:h-11 sm:w-[224px]"
      style={cor ? { backgroundColor: cor.fundo, borderColor: cor.borda, color: cor.texto } : undefined}>
      <Compass className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-left"><SelectValue placeholder="Todas as origens" /></span>
    </SelectTrigger>
    <SelectContent position="popper" align="start" sideOffset={6}
      className="z-[100] max-h-80 w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] rounded-xl border-slate-700 bg-slate-950 p-1 text-slate-100 shadow-2xl">
      <SelectItem value={TODAS_ORIGENS_QUADRO} className="min-h-10 cursor-pointer rounded-lg px-3 pr-9">Todas as origens</SelectItem>
      {origens.map((origem) => <SelectItem key={valorSelectOrigemQuadro(origem)} value={valorSelectOrigemQuadro(origem)}
        className="min-h-10 cursor-pointer rounded-lg px-3 pr-9 focus:bg-white/10 focus:text-white">
        <span className="inline-flex min-w-0 items-center gap-2">
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: corOrigemQuadro(origem).ponto }} aria-hidden="true" />
          <span className="truncate">{origem ?? "Sem origem"}</span>
        </span>
      </SelectItem>)}
    </SelectContent>
  </Select>;
}
