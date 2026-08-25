"use client";

import Link from "next/link";
import { KanbanSquare, ArrowRight, Inbox } from "lucide-react";
import { CrmPipelineBorder } from "@/components/ui/crm-pipeline-border";

type Pipeline = {
  id: string;
  nome: string;
  _count: { cards: number };
};

interface Props {
  pipelines: Pipeline[];
  erro: string | null;
  accent: string;
}

export default function PipelinesListClient({ pipelines, erro, accent }: Props) {
  if (erro) {
    return (
      <div className="p-6">
        <p className="text-sm text-rose-300">{erro}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-black text-white mb-1">Pipelines</h1>
        <p className="text-sm text-slate-400">
          Selecione um pipeline para abrir o board de processos.
        </p>
      </div>

      {pipelines.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: `rgba(${accent},0.15)` }}
          >
            <Inbox size={22} style={{ color: `rgb(${accent})` }} />
          </div>
          <p className="text-sm text-slate-400">Nenhum pipeline configurado ainda.</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-6">
          {pipelines.map((pipeline) => (
            <CrmPipelineBorder
              key={pipeline.id}
              className="w-full md:w-[340px] lg:w-[380px] xl:w-[420px] max-w-full min-h-[200px] shadow-[0_4px_16px_rgba(0,0,0,0.3),0_12px_40px_rgba(0,0,0,0.2)] transition-shadow duration-300 ease-out hover:shadow-[0_8px_24px_rgba(0,0,0,0.4),0_16px_48px_rgba(0,0,0,0.25)]"
            >
              <Link
                href={`/PainelAlpha/AlphaCRM/pipeline/${pipeline.id}`}
                className="block p-5 transition-colors group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: `rgba(${accent},0.15)` }}
                  >
                    <KanbanSquare size={17} style={{ color: `rgb(${accent})` }} />
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-slate-600 group-hover:text-white transition-colors"
                  />
                </div>
                <h3 className="font-bold text-white mb-1">{pipeline.nome}</h3>
                <p className="text-xs text-slate-400">
                  {pipeline._count.cards} card(s)
                </p>
              </Link>
            </CrmPipelineBorder>
          ))}
        </div>
      )}
    </div>
  );
}
