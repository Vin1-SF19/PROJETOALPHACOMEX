"use client";

import { useDraggable } from "@dnd-kit/core";
import type { TipoComponente } from "../registry/componentes-registry";
import { COMPONENTES_REGISTRY, ehTipoFundo } from "../registry/componentes-registry";

export function ItemComponenteArrastavel({ tipo, onAplicarFundo }: { tipo: TipoComponente; onAplicarFundo: (tipo: TipoComponente) => void }) {
  const entry = COMPONENTES_REGISTRY[tipo];
  const fundo = ehTipoFundo(tipo);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `paleta-${tipo}`, data: { tipo }, disabled: fundo });
  const Icone = entry.icone;

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      type="button"
      onClick={fundo ? () => onAplicarFundo(tipo) : undefined}
      aria-label={fundo ? `Aplicar fundo ${entry.label}` : `Adicionar componente ${entry.label}`}
      title={fundo ? "Clique para aplicar ao slide" : "Arraste para adicionar ao slide"}
      className={`flex flex-col items-center gap-1.5 rounded-xl border border-white/5 bg-slate-900/60 p-3 text-slate-300 transition-colors hover:border-indigo-500/40 hover:text-white ${fundo ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}`}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      {entry.imagemPreview ? (
        // eslint-disable-next-line @next/next/no-img-element -- prévia real do asset (moldura/forma com arte própria), miniatura pequena na sidebar
        <img src={entry.imagemPreview} alt="" className="h-9 w-9 object-contain" />
      ) : (
        <Icone size={20} aria-hidden="true" />
      )}
      <span className="text-[10px] font-medium">{entry.label}</span>
      {fundo && <span className="text-[8px] font-semibold uppercase tracking-wider text-indigo-300">Clique para aplicar</span>}
    </button>
  );
}
