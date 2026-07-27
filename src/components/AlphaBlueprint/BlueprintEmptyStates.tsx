"use client";

import { Compass, Plus } from "lucide-react";

interface BlueprintEmptyDashboardProps {
  accent: string;
  onCriar: () => void;
}

export function BlueprintEmptyDashboard({ accent, onCriar }: BlueprintEmptyDashboardProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: `rgba(${accent},0.1)` }}
      >
        <Compass size={28} style={{ color: `rgb(${accent})` }} />
      </div>
      <div>
        <p className="text-white font-medium">Nenhum sistema registrado ainda</p>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">
          Comece registrando uma ideia, mesmo incompleta — você pode completar os detalhes aos poucos.
        </p>
      </div>
      <button
        onClick={onCriar}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white mt-2"
        style={{ background: `rgba(${accent},0.9)` }}
      >
        <Plus size={16} />
        Criar primeiro sistema
      </button>
    </div>
  );
}

export function BlueprintKanbanSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {Array.from({ length: 5 }).map((_, colIdx) => (
        <div key={colIdx} className="flex flex-col shrink-0 w-72 gap-2">
          <div className="h-4 w-24 rounded bg-white/5 animate-pulse" />
          {Array.from({ length: 2 }).map((_, cardIdx) => (
            <div key={cardIdx} className="h-28 rounded-2xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  );
}
