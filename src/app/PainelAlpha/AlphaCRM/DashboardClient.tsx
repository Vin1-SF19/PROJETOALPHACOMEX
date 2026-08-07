"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  KanbanSquare,
  ArrowRight,
  AlertTriangle,
  ListChecks,
  CheckCircle2,
  Activity,
  Clock,
} from "lucide-react";
import type { TemaAlpha } from "@/lib/temas";
import { fmtDateTime } from "@/lib/format-date";
import { ObterDashboardBpm } from "@/actions/bpm/Dashboard";
import CardFullViewModal from "./CardModal/CardFullViewModal";

type DashboardData = NonNullable<Awaited<ReturnType<typeof ObterDashboardBpm>>["data"]>;

interface Props {
  dashboard: DashboardData | null;
  erro: string | null;
  visual: TemaAlpha;
  currentUserId: number | null;
  currentUserRole: string | null;
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  accent: string;
  tone?: "danger";
}) {
  return (
    <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: tone === "danger" ? "rgba(244,63,94,0.15)" : `rgba(${accent},0.15)` }}
      >
        <Icon size={18} style={{ color: tone === "danger" ? "rgb(244,63,94)" : `rgb(${accent})` }} />
      </div>
      <div>
        <p className="text-2xl font-black text-white leading-none">{value}</p>
        <p className="text-xs text-slate-500 mt-1">{label}</p>
      </div>
    </div>
  );
}

export default function DashboardClient({ dashboard, erro, visual, currentUserId, currentUserRole }: Props) {
  const accent = visual.accent;
  const [cardSelecionadoId, setCardSelecionadoId] = useState<string | null>(null);
  const [agora] = useState(() => Date.now());
  const tarefasOrdenadas = useMemo(() => {
    const tarefasPendentes = dashboard?.tarefasPendentes ?? [];
    return [...tarefasPendentes].sort((a, b) => {
      const aAtrasada = a.prazo ? new Date(a.prazo).getTime() < agora : false;
      const bAtrasada = b.prazo ? new Date(b.prazo).getTime() < agora : false;
      if (aAtrasada !== bAtrasada) return aAtrasada ? -1 : 1;
      return 0;
    });
  }, [dashboard, agora]);

  if (erro || !dashboard) {
    return (
      <div className="p-6">
        <p className="text-sm text-rose-300">{erro ?? "Erro ao carregar dashboard"}</p>
      </div>
    );
  }

  const { pipelines, totalAtivos, concluidasSemana, tarefasAtrasadasCount, historicoRecente } = dashboard;

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-xl font-black text-white mb-1">Dashboard</h1>
        <p className="text-sm text-slate-400">Visão geral dos processos em andamento.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Activity} label="Cards ativos" value={totalAtivos} accent={accent} />
        <StatCard icon={AlertTriangle} label="Tarefas atrasadas" value={tarefasAtrasadasCount} accent={accent} tone="danger" />
        <StatCard icon={ListChecks} label="Tarefas pendentes" value={tarefasOrdenadas.length} accent={accent} />
        <StatCard icon={CheckCircle2} label="Concluídos (7 dias)" value={concluidasSemana} accent={accent} />
      </div>

      {/* Pipelines */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide">Pipelines</h2>
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
                <h3 className="font-bold text-white mb-1">{pipeline.nome}</h3>
                <p className="text-xs text-slate-400">{pipeline._count.cards} card(s)</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tarefas pendentes/atrasadas */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wide">Tarefas pendentes</h2>
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
            {tarefasOrdenadas.length === 0 && <p className="text-xs text-slate-600">Nenhuma tarefa pendente.</p>}
            {tarefasOrdenadas.map((t) => {
              const atrasada = t.prazo ? new Date(t.prazo).getTime() < agora : false;
              return (
                <button
                  key={t.id}
                  onClick={() => setCardSelecionadoId(t.cardId)}
                  className="w-full flex items-center justify-between gap-3 bg-slate-900/60 border border-white/5 rounded-xl px-3 py-2.5 text-left hover:border-white/15 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{t.titulo}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {t.card.empresa.razaoSocial} · {t.card.pipeline.nome}
                    </p>
                  </div>
                  {t.prazo && (
                    <span
                      className={`shrink-0 flex items-center gap-1 text-[11px] font-semibold ${atrasada ? "text-rose-400" : "text-slate-400"}`}
                    >
                      <Clock size={11} />
                      {fmtDateTime(t.prazo)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Atividade recente */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wide">Atividade recente</h2>
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
            {historicoRecente.length === 0 && <p className="text-xs text-slate-600">Sem atividade recente.</p>}
            {historicoRecente.map((h) => (
              <button
                key={h.id}
                onClick={() => setCardSelecionadoId(h.card.id)}
                className="w-full text-left bg-slate-900/60 border border-white/5 rounded-xl px-3 py-2.5 hover:border-white/15 transition-colors block"
              >
                <p className="text-sm text-slate-200">
                  <span className="text-white font-medium">{h.usuario?.nome ?? "sistema"}</span> — {h.acao}
                </p>
                <p className="text-xs text-slate-500">
                  {h.card.empresa.razaoSocial} · {h.card.pipeline.nome} · {fmtDateTime(h.createdAt)}
                </p>
              </button>
            ))}
          </div>
        </section>
      </div>

      {cardSelecionadoId && (
        <CardFullViewModal
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
