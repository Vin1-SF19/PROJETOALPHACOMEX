"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { BlueprintProjectCard } from "./BlueprintProjectCard";
import { STATUS_LABELS, type ProjetoBlueprintCard } from "./tipos";

interface BlueprintColumnProps {
  status: string;
  projetos: ProjetoBlueprintCard[];
  accent: string;
  modoSelecao?: boolean;
  selecionados?: Set<string>;
  onToggleSelecionado?: (id: string) => void;
  onAbrirProjeto: (id: string) => void;
}

export function BlueprintColumn({
  status, projetos, accent, modoSelecao = false, selecionados, onToggleSelecionado, onAbrirProjeto,
}: BlueprintColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: modoSelecao });

  return (
    <div className="flex flex-col shrink-0 w-72 snap-start">
      <div className="flex items-center justify-between px-1 pb-2 sticky top-0 z-10">
        <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
          {STATUS_LABELS[status] ?? status}
        </h3>
        <span className="text-[10px] text-slate-500 bg-white/5 rounded-full px-1.5 py-0.5">
          {projetos.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 rounded-2xl p-2 min-h-[120px] transition-colors ${
          isOver ? "bg-white/[0.03] ring-1 ring-white/10" : ""
        }`}
      >
        <SortableContext items={projetos.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {projetos.map((projeto) => (
            <BlueprintProjectCard
              key={projeto.id}
              projeto={projeto}
              accent={accent}
              onAbrir={onAbrirProjeto}
              modoSelecao={modoSelecao}
              selecionado={selecionados?.has(projeto.id) ?? false}
              onToggleSelecionado={onToggleSelecionado}
            />
          ))}
        </SortableContext>
        {projetos.length === 0 && (
          <div className="text-[11px] text-slate-600 text-center py-6 border border-dashed border-white/5 rounded-xl">
            Nenhum projeto
          </div>
        )}
      </div>
    </div>
  );
}
