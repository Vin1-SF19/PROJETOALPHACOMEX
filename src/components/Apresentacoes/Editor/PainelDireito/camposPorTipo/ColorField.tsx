"use client";

import { useState } from "react";
import { Check } from "lucide-react";

const HEX_VALIDO = /^#[0-9a-fA-F]{6}$/;
const inputClass = "w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500";

/** Paleta fixa de swatches predefinidos — dá uma opção visual rápida sem exigir digitar hex,
 * sem depender de nenhuma lib externa de color picker (mesmo padrão simples já usado no projeto). */
const PALETA_PREDEFINIDA = [
  "#ffffff", "#000000", "#94a3b8", "#64748b",
  "#4f46e5", "#0ea5e9", "#06b6d4", "#10b981",
  "#84cc16", "#eab308", "#f59e0b", "#f97316",
  "#ef4444", "#ec4899", "#d946ef", "#8b5cf6",
];

interface ColorFieldProps {
  id: string;
  label: string;
  value: string;
  fallback: string;
  onChange: (value: string) => void;
}

/** Swatch nativo (`type="color"`) + campo de texto + paleta de cores predefinidas em popover —
 * o usuário pode escolher clicando numa cor pronta, usando o seletor visual nativo, OU
 * continuar digitando o hex. Nenhum caminho é removido, só adicionado. */
export function ColorField({ id, label, value, fallback, onChange }: ColorFieldProps) {
  const [paletaAberta, setPaletaAberta] = useState(false);
  const corSwatch = HEX_VALIDO.test(value) ? value : fallback;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[11px] text-slate-400">{label}</label>
        <button
          type="button"
          onClick={() => setPaletaAberta((aberta) => !aberta)}
          aria-expanded={paletaAberta}
          aria-label="Escolher de uma paleta de cores"
          className="text-[10px] font-medium text-indigo-300 hover:text-indigo-200"
        >
          {paletaAberta ? "Fechar paleta" : "Paleta"}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={corSwatch}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-11 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-slate-900 p-1"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fallback}
          className={`${inputClass} min-w-0 flex-1`}
        />
      </div>
      {paletaAberta && (
        <div className="grid grid-cols-8 gap-1.5 rounded-lg border border-white/10 bg-slate-950/60 p-2">
          {PALETA_PREDEFINIDA.map((cor) => (
            <button
              key={cor}
              type="button"
              onClick={() => onChange(cor)}
              aria-label={`Usar cor ${cor}`}
              title={cor}
              className="flex size-6 items-center justify-center rounded-md border border-white/10"
              style={{ backgroundColor: cor }}
            >
              {corSwatch.toLowerCase() === cor.toLowerCase() && (
                <Check size={12} className={cor === "#ffffff" || cor === "#eab308" ? "text-slate-900" : "text-white"} aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
