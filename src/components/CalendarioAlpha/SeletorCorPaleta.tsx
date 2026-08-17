"use client";

import { Check } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PALETA_CORES_COLEGAS } from "@/lib/google-calendar/colegas";
import { cn } from "@/lib/utils";

interface SeletorCorPaletaProps {
  corAtual: string;
  onEscolher: (cor: string) => void;
  label: string;
  disabled?: boolean;
}

/**
 * Substitui `<input type="color">` nativo por uma paleta fixa de 16 cores em bolinhas —
 * clique único, sem o problema do picker do SO disparar `onChange` a cada frame de arraste
 * (dezenas de Server Actions concorrentes sem debounce, causa raiz do bug relatado).
 */
export function SeletorCorPaleta({ corAtual, onEscolher, label, disabled }: SeletorCorPaletaProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={label}
          className="size-4 shrink-0 rounded-full ring-1 ring-white/20 transition-transform hover:scale-110 disabled:pointer-events-none disabled:opacity-50"
          style={{ backgroundColor: corAtual }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="grid grid-cols-4 gap-2">
          {PALETA_CORES_COLEGAS.map((cor) => {
            const selecionada = cor.toLowerCase() === corAtual.toLowerCase();
            return (
              <button
                key={cor}
                type="button"
                onClick={() => onEscolher(cor)}
                aria-label={`Escolher cor ${cor}`}
                aria-pressed={selecionada}
                className={cn(
                  "flex size-7 items-center justify-center rounded-full ring-1 ring-white/10 transition-transform hover:scale-110",
                  selecionada && "ring-2 ring-white/80",
                )}
                style={{ backgroundColor: cor }}
              >
                {selecionada && <Check className="size-3.5 text-white drop-shadow" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
