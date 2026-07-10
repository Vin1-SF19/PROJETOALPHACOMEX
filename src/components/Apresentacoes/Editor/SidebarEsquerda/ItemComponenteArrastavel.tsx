"use client";

import { useDraggable } from "@dnd-kit/core";
import type { TipoComponente } from "../registry/componentes-registry";
import { COMPONENTES_REGISTRY } from "../registry/componentes-registry";

export function ItemComponenteArrastavel({ tipo }: { tipo: TipoComponente }) {
  const entry = COMPONENTES_REGISTRY[tipo];
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `paleta-${tipo}`, data: { tipo } });
  const Icone = entry.icone;

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      type="button"
      aria-label={`Adicionar componente ${entry.label}`}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-white/5 bg-slate-900/60 p-3 text-slate-300 transition-colors hover:border-indigo-500/40 hover:text-white cursor-grab active:cursor-grabbing"
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <Icone size={20} aria-hidden="true" />
      <span className="text-[10px] font-medium">{entry.label}</span>
    </button>
  );
}
