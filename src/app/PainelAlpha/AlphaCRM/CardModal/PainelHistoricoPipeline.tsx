"use client";

import { useEffect, useState } from "react";
import { Loader2, KanbanSquare } from "lucide-react";
import { fmtDateTime } from "@/lib/format-date";
import { ListarCardsEmpresaPorPipeline } from "@/actions/bpm/Cards";
import { SectionCard } from "./PainelHistorico";

type CardsPipeline = NonNullable<Awaited<ReturnType<typeof ListarCardsEmpresaPorPipeline>>["data"]>;

interface Props {
  cardId: string;
  pipelineId: string;
  pipelineNome: string;
  accent: string;
  onAbrirCard: (cardId: string) => void;
}

export default function PainelHistoricoPipeline({ cardId, pipelineId, pipelineNome, accent, onAbrirCard }: Props) {
  const [dados, setDados] = useState<CardsPipeline | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    ListarCardsEmpresaPorPipeline(cardId, pipelineId).then((res) => {
      if (cancelado) return;
      if (!res.success) {
        setErro(typeof res.error === "string" ? res.error : "Erro ao carregar cards do pipeline");
        return;
      }
      setDados(res.data ?? []);
    });

    return () => { cancelado = true; };
  }, [cardId, pipelineId]);

  if (erro) {
    return (
      <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-4">
        <p className="text-sm text-rose-300">{erro}</p>
      </div>
    );
  }

  if (!dados) {
    return (
      <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-slate-500" size={22} />
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent overflow-y-auto p-4 space-y-3">
      {dados.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
          <p className="text-xs text-slate-500">Esta empresa não possui outros cards em {pipelineNome}.</p>
        </div>
      ) : (
        <SectionCard icon={KanbanSquare} title={`Cards em ${pipelineNome}`} count={dados.length} accent={accent} defaultOpen>
          <div className="space-y-1.5 mt-2">
            {dados.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onAbrirCard(c.id)}
                className="w-full flex items-center justify-between gap-2 bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2 text-left hover:border-white/10"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-200 truncate">{c.servico || c.etapa.nome}</div>
                  <div className="text-[11px] text-slate-500">{c.etapa.nome} · {fmtDateTime(c.createdAt)}</div>
                </div>
              </button>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
