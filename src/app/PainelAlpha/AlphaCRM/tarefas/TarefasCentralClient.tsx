"use client";

import { useMemo, useState } from "react";
import { Search, Clock } from "lucide-react";
import type { TemaAlpha } from "@/lib/temas";
import { fmtDateTime } from "@/lib/format-date";
import { ListarTarefasGlobaisBpm } from "@/actions/bpm/Tarefas";
import CardDetailDrawer from "../pipeline/[pipelineId]/CardDetailDrawer";

type Tarefa = Awaited<ReturnType<typeof ListarTarefasGlobaisBpm>>["data"][number];

interface Props {
  tarefas: Tarefa[];
  visual: TemaAlpha;
  currentUserId: number | null;
  currentUserRole: string | null;
}

const FILTROS = [
  { valor: "TODAS", label: "Todas" },
  { valor: "PENDENTE", label: "Pendentes" },
  { valor: "CONCLUIDA", label: "Concluídas" },
] as const;

const PRIORIDADE_COR: Record<string, string> = {
  BAIXA: "text-slate-400",
  NORMAL: "text-sky-400",
  ALTA: "text-amber-400",
  URGENTE: "text-rose-400",
};

export default function TarefasCentralClient({ tarefas, visual, currentUserId, currentUserRole }: Props) {
  const accent = visual.accent;
  const [filtroStatus, setFiltroStatus] = useState<(typeof FILTROS)[number]["valor"]>("PENDENTE");
  const [busca, setBusca] = useState("");
  const [cardSelecionadoId, setCardSelecionadoId] = useState<string | null>(null);
  const [agora] = useState(() => Date.now());

  const tarefasFiltradas = useMemo(() => {
    return tarefas.filter((t) => {
      if (filtroStatus !== "TODAS" && t.status !== filtroStatus) return false;
      if (busca.trim()) {
        const alvo = `${t.titulo} ${t.card.empresa.razaoSocial} ${t.card.pipeline.nome}`.toLowerCase();
        if (!alvo.includes(busca.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [tarefas, filtroStatus, busca]);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-black text-white mb-1">Central de Tarefas</h1>
        <p className="text-sm text-slate-400">Todas as tarefas dos seus cards em um só lugar.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              onClick={() => setFiltroStatus(f.valor)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
              style={
                filtroStatus === f.valor
                  ? { background: `rgba(${accent},0.2)`, color: `rgb(${accent})` }
                  : { color: "#94a3b8" }
              }
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="w-full bg-slate-900/60 border border-white/5 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-600"
            placeholder="Buscar por título, empresa ou pipeline..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        {tarefasFiltradas.length === 0 && <p className="text-sm text-slate-600">Nenhuma tarefa encontrada.</p>}
        {tarefasFiltradas.map((t) => {
          const atrasada = t.prazo && t.status === "PENDENTE" ? new Date(t.prazo).getTime() < agora : false;
          return (
            <button
              key={t.id}
              onClick={() => setCardSelecionadoId(t.cardId)}
              className="w-full flex items-center justify-between gap-3 bg-slate-900/60 border border-white/5 rounded-xl px-4 py-3 text-left hover:border-white/15 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${t.status === "CONCLUIDA" ? "line-through text-slate-500" : "text-white"}`}>
                  {t.titulo}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {t.card.empresa.razaoSocial} · {t.card.pipeline.nome}
                  {t.responsavel && ` · ${t.responsavel.nome}`}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-[11px] font-semibold uppercase ${PRIORIDADE_COR[t.prioridade] ?? "text-slate-400"}`}>
                  {t.prioridade}
                </span>
                {t.prazo && (
                  <span className={`flex items-center gap-1 text-[11px] font-semibold ${atrasada ? "text-rose-400" : "text-slate-400"}`}>
                    <Clock size={11} />
                    {fmtDateTime(t.prazo)}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {cardSelecionadoId && (
        <CardDetailDrawer
          cardId={cardSelecionadoId}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          accent={accent}
          onClose={() => setCardSelecionadoId(null)}
          onAtualizado={() => {}}
          onAbrirCard={(id) => setCardSelecionadoId(id)}
        />
      )}
    </div>
  );
}
