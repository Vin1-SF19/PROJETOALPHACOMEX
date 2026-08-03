"use client";

import Link from "next/link";
import { KanbanSquare, ArrowRight } from "lucide-react";
import type { TemaAlpha } from "@/lib/temas";

interface PipelineResumo {
  id: string;
  nome: string;
  ativo: boolean;
  setores: { setor: { id: number; nome: string } }[];
  _count: { cards: number; etapas: number };
}

export default function PipelinesListClient({ pipelines, visual }: { pipelines: PipelineResumo[]; visual: TemaAlpha }) {
  const accent = visual.accent;

  return (
    <div className="p-6">
      <h1 className="text-xl font-black text-white mb-1">Pipelines</h1>
      <p className="text-sm text-slate-400 mb-6">Selecione um processo para abrir o Kanban.</p>

      {pipelines.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum pipeline configurado ainda.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pipelines.map((pipeline) => (
            <Link
              key={pipeline.id}
              href={`/PainelAlpha/AlphaCRM/pipeline/${pipeline.id}`}
              className="bg-slate-900/60 border border-white/5 rounded-2xl p-5 hover:border-white/15 transition-colors group"
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: `rgba(${accent},0.15)` }}
                >
                  <KanbanSquare size={17} style={{ color: `rgb(${accent})` }} />
                </div>
                <ArrowRight size={16} className="text-slate-600 group-hover:text-white transition-colors" />
              </div>
              <h2 className="font-bold text-white mb-1">{pipeline.nome}</h2>
              <p className="text-xs text-slate-500 mb-3">
                {pipeline.setores.map((s) => s.setor.nome).join(", ") || "Sem setor vinculado"}
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>{pipeline._count.cards} card(s)</span>
                <span>{pipeline._count.etapas} etapa(s)</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
