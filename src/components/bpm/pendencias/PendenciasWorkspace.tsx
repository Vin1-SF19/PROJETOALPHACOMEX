"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckSquare,
  ClipboardList,
  ListTodo,
  ShieldAlert,
  TimerReset,
} from "lucide-react";
import { fmtDateTime } from "@/lib/format-date";
import type { ItemPendencia, TipoPendencia } from "@/lib/bpm/pendencias/motor";

const TIPO_META: Record<TipoPendencia, { label: string; icon: typeof AlertTriangle; cor: string }> = {
  TAREFA_PENDENTE: { label: "Tarefa pendente", icon: ListTodo, cor: "text-sky-300 border-sky-400/25 bg-sky-400/[0.08]" },
  PROXIMO_CONTATO_VENCIDO: { label: "Próximo contato vencido", icon: CalendarClock, cor: "text-amber-300 border-amber-400/25 bg-amber-400/[0.08]" },
  CHECKLIST_PENDENTE: { label: "Checklist pendente", icon: CheckSquare, cor: "text-violet-300 border-violet-400/25 bg-violet-400/[0.08]" },
  CAMPO_OBRIGATORIO_FALTANTE: { label: "Campo obrigatório faltando", icon: ClipboardList, cor: "text-rose-300 border-rose-400/25 bg-rose-400/[0.08]" },
  SLA_PROXIMO: { label: "SLA próximo do vencimento", icon: TimerReset, cor: "text-amber-300 border-amber-400/25 bg-amber-400/[0.08]" },
  SLA_VENCIDO: { label: "SLA vencido", icon: ShieldAlert, cor: "text-rose-300 border-rose-400/25 bg-rose-400/[0.08]" },
};

const FILTROS: { value: TipoPendencia | "TODOS"; label: string }[] = [
  { value: "TODOS", label: "Todos" },
  { value: "TAREFA_PENDENTE", label: "Tarefas" },
  { value: "PROXIMO_CONTATO_VENCIDO", label: "Próximo contato" },
  { value: "CHECKLIST_PENDENTE", label: "Checklists" },
  { value: "CAMPO_OBRIGATORIO_FALTANTE", label: "Campos faltantes" },
  { value: "SLA_PROXIMO", label: "SLA próximo" },
  { value: "SLA_VENCIDO", label: "SLA vencido" },
];

export function PendenciasWorkspace({ itens, erro, accent }: { itens: ItemPendencia[]; erro: string | null; accent: string }) {
  const [filtro, setFiltro] = useState<TipoPendencia | "TODOS">("TODOS");

  const filtrados = useMemo(
    () => (filtro === "TODOS" ? itens : itens.filter((item) => item.tipo === filtro)),
    [itens, filtro],
  );

  const contagens = useMemo(() => {
    const mapa = new Map<TipoPendencia, number>();
    for (const item of itens) mapa.set(item.tipo, (mapa.get(item.tipo) ?? 0) + 1);
    return mapa;
  }, [itens]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle size={18} style={{ color: `rgb(${accent})` }} />
        <h1 className="text-lg font-bold text-slate-100">Central de Pendências</h1>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-slate-400">{itens.length}</span>
      </div>
      <p className="text-xs text-slate-400">O que precisa de ação, em qual card, e desde quando — consolidado dos módulos do CRM/BPM.</p>

      {erro && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">{erro}</div>}

      <div className="flex flex-wrap gap-1.5">
        {FILTROS.map((item) => (
          <button
            key={item.value}
            onClick={() => setFiltro(item.value)}
            className="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors"
            style={
              filtro === item.value
                ? { background: `rgba(${accent},0.18)`, borderColor: `rgba(${accent},0.4)`, color: `rgb(${accent})` }
                : { borderColor: "rgba(255,255,255,0.1)", color: "rgb(148,163,184)" }
            }
          >
            {item.label}
            {item.value !== "TODOS" && contagens.get(item.value) ? ` (${contagens.get(item.value)})` : ""}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        {filtrados.length === 0 && (
          <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-xs text-slate-500">Nenhuma pendência — tudo em dia.</p>
        )}
        {filtrados.map((item, indice) => {
          const meta = TIPO_META[item.tipo];
          const Icone = meta.icon;
          return (
            <Link
              key={`${item.tipo}-${item.cardId}-${indice}`}
              href={`/PainelAlpha/AlphaCRM/pipeline/${item.pipelineId}`}
              className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 text-xs transition-colors hover:brightness-110 ${meta.cor}`}
            >
              <Icone size={14} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.titulo}</p>
                <p className="mt-0.5 text-[10px] opacity-75">
                  {item.pipelineNome} · {item.etapaNome}
                  {item.responsavelNome ? ` · ${item.responsavelNome}` : ""}
                  {item.prazo ? ` · ${fmtDateTime(item.prazo)}` : ""}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
