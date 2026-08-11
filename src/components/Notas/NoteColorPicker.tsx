"use client";

import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Check, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

const CORES_DISPONIVEIS = [
  "#f59e0b", // amber
  "#f43f5e", // rose
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#3b82f6", // blue
  "#ec4899", // pink
  "#84cc16", // lime
];

interface NoteColorPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  corAtual?: string | null;
  onEscolher: (cor: string | null) => void;
  /** Posição de referência (ex: ponto do clique) — o popover ancora ali via Popover.Anchor invisível. */
  posicao: { x: number; y: number };
}

/**
 * Seletor de cor de nota — controlado externamente (sem trigger próprio) porque é acionado
 * a partir de um item de DropdownMenu, que já fecha ao clicar (mesmo padrão usado no menu de
 * contexto da aba para o clique direito).
 */
export function NoteColorPicker({ open, onOpenChange, corAtual, onEscolher, posicao }: NoteColorPickerProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <span aria-hidden="true" className="pointer-events-none fixed h-px w-px" style={{ left: posicao.x, top: posicao.y }} />
      </PopoverAnchor>
      <PopoverContent align="start" className="w-56 border-white/10 bg-[#0b1120] p-3">
        <p className="mb-2 text-[10px] uppercase tracking-wide text-slate-500">Cor da aba</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            title="Sem cor"
            onClick={() => {
              onEscolher(null);
              onOpenChange(false);
            }}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-500 hover:bg-white/10",
              !corAtual && "ring-2 ring-white/40",
            )}
          >
            <Ban size={13} />
          </button>
          {CORES_DISPONIVEIS.map((cor) => (
            <button
              key={cor}
              type="button"
              title={cor}
              onClick={() => {
                onEscolher(cor);
                onOpenChange(false);
              }}
              style={{ background: cor }}
              className="flex h-7 w-7 items-center justify-center rounded-full"
            >
              {corAtual === cor && <Check size={13} className="text-white drop-shadow" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
