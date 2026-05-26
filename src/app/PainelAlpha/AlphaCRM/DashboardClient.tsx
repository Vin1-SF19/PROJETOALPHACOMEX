"use client";

import { useState } from "react";
import { fmtDateLong } from "@/lib/format-date";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  TrendingUp, Users, CalendarCheck, CheckCircle2,
  AlertCircle, DollarSign, Target, ArrowRight,
  Phone, Mail, Video, FileText, StickyNote,
} from "lucide-react";
import { criarOportunidade } from "@/actions/CRM";
import type { TemaAlpha } from "@/lib/temas";

const ETAPAS_LABEL: Record<string, string> = {
  PROSPECCAO: "Prospecção",
  QUALIFICACAO: "Qualificação",
  REUNIAO: "Reunião Marcada",
  PROPOSTA: "Proposta Enviada",
  NEGOCIACAO: "Negociação",
  FECHADO_GANHO: "Fechado ✓",
  FECHADO_PERDIDO: "Perdido",
};

const TIPO_ICON: Record<string, React.ReactNode> = {
  LIGACAO: <Phone size={13} />,
  EMAIL: <Mail size={13} />,
  REUNIAO: <Video size={13} />,
  TAREFA: <FileText size={13} />,
  NOTA: <StickyNote size={13} />,
};

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function fmtData(s?: string | null) {
  if (!s) return null;
  const d = new Date(s);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

interface Props {
  stats: any;
  atividadesPendentes: any[];
  oportunidades: any[];
  visual: TemaAlpha;
  session: any;
}

function DashboardKPI({ label, value, sub, icon: Icon, color, accent }: any) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3 border border-white/5 bg-slate-900/60"
      style={{ borderColor: `rgba(${accent},0.1)` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">{label}</span>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `rgba(${accent},0.15)` }}>
          <Icon size={15} style={{ color: `rgb(${accent})` }} />
        </div>
      </div>
      <div>
        <p className="text-2xl font-black text-white">{value}</p>
        {sub && <p className={`text-xs mt-0.5 ${color || "text-slate-500"}`}>{sub}</p>}
      </div>
    </div>
  );
}

export default function DashboardCRM({ stats, atividadesPendentes, oportunidades, visual, session }: Props) {
  const accent = visual.accent;
  const router = useRouter();
  const [showNovaOp, setShowNovaOp] = useState(false);
  const [novaOp, setNovaOp] = useState({ titulo: "", empresa: "", valor: "", etapa: "PROSPECCAO" });
  const [saving, setSaving] = useState(false);

  const hoje = new Date().toISOString().split("T")[0];

  const recentesOps = oportunidades
    .filter((o: any) => !["FECHADO_GANHO", "FECHADO_PERDIDO"].includes(o.etapa))
    .slice(0, 6);

  async function handleCriarOp() {
    if (!novaOp.titulo.trim()) return;
    setSaving(true);
    await criarOportunidade({
      titulo: novaOp.titulo,
      empresa: novaOp.empresa || undefined,
      valor: novaOp.valor ? Number(novaOp.valor) : undefined,
      etapa: novaOp.etapa as any,
    });
    setSaving(false);
    setShowNovaOp(false);
    setNovaOp({ titulo: "", empresa: "", valor: "", etapa: "PROSPECCAO" });
    router.refresh();
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">Dashboard</h1>
          <p className="text-sm text-slate-500" suppressHydrationWarning>
            {fmtDateLong(new Date())}
          </p>
        </div>
        <button
          onClick={() => setShowNovaOp(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: `rgba(${accent},0.85)` }}
        >
          + Nova Oportunidade
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <DashboardKPI accent={accent} label="Pipeline Total" value={fmtBRL(stats.pipelineTotal)} icon={DollarSign}
          sub={`${stats.totalOportunidades} oportunidades ativas`} />
        <DashboardKPI accent={accent} label="Receita Fechada" value={fmtBRL(stats.receitaFechada)} icon={TrendingUp}
          sub={`Taxa de conversão: ${stats.taxaConversao}%`} color="text-emerald-400" />
        <DashboardKPI accent={accent} label="Contatos" value={stats.totalContatos} icon={Users}
          sub="Na base do CRM" />
        <DashboardKPI accent={accent} label="Atividades Hoje" value={stats.atividadesHoje} icon={CalendarCheck}
          sub={stats.atividadesAtrasadas > 0 ? `${stats.atividadesAtrasadas} atrasadas` : "Em dia"}
          color={stats.atividadesAtrasadas > 0 ? "text-rose-400" : "text-emerald-400"} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Pipeline por etapa */}
        <div
          className="xl:col-span-2 rounded-2xl p-5 border border-white/5 bg-slate-900/60 space-y-4"
          style={{ borderColor: `rgba(${accent},0.1)` }}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white text-sm">Oportunidades Ativas</h2>
            <Link
              href="/PainelAlpha/AlphaCRM/pipeline"
              className="flex items-center gap-1 text-xs font-medium transition-colors"
              style={{ color: `rgb(${accent})` }}
            >
              Ver Kanban <ArrowRight size={12} />
            </Link>
          </div>
          <div className="space-y-2">
            {recentesOps.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-6">Nenhuma oportunidade aberta.</p>
            ) : (
              recentesOps.map((op: any) => (
                <div
                  key={op.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{op.titulo}</p>
                    <p className="text-xs text-slate-400 truncate">{op.empresa || op.cliente?.razaoSocial || "—"}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-3 shrink-0">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `rgba(${accent},0.15)`, color: `rgb(${accent})` }}
                    >
                      {ETAPAS_LABEL[op.etapa] || op.etapa}
                    </span>
                    {op.valor ? (
                      <span className="text-xs font-bold text-emerald-400">{fmtBRL(op.valor)}</span>
                    ) : (
                      <span className="text-xs text-slate-600">—</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Atividades pendentes */}
        <div
          className="rounded-2xl p-5 border border-white/5 bg-slate-900/60 space-y-4"
          style={{ borderColor: `rgba(${accent},0.1)` }}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white text-sm">Atividades Pendentes</h2>
            <Link
              href="/PainelAlpha/AlphaCRM/atividades"
              className="text-xs font-medium transition-colors"
              style={{ color: `rgb(${accent})` }}
            >
              Ver todas
            </Link>
          </div>
          <div className="space-y-2">
            {atividadesPendentes.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-6">Nenhuma atividade pendente.</p>
            ) : (
              atividadesPendentes.map((a: any) => {
                const atrasada = a.dataPrevista && a.dataPrevista < hoje;
                return (
                  <div
                    key={a.id}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800/60 border border-white/5"
                  >
                    <div
                      className="mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `rgba(${accent},0.15)`, color: `rgb(${accent})` }}
                    >
                      {TIPO_ICON[a.tipo] || <CalendarCheck size={13} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white leading-tight truncate">{a.titulo}</p>
                      {a.oportunidade && (
                        <p className="text-[10px] text-slate-500 truncate">{a.oportunidade.titulo}</p>
                      )}
                      {a.dataPrevista && (
                        <p className={`text-[10px] font-medium mt-0.5 ${atrasada ? "text-rose-400" : "text-slate-500"}`}>
                          {atrasada ? "⚠ " : ""}{fmtData(a.dataPrevista)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Funil de Conversão */}
      <div
        className="rounded-2xl p-5 border border-white/5 bg-slate-900/60"
        style={{ borderColor: `rgba(${accent},0.1)` }}
      >
        <h2 className="font-bold text-white text-sm mb-4">Funil de Conversão</h2>
        <div className="flex items-end gap-2 h-24">
          {Object.entries(ETAPAS_LABEL).map(([etapa, label]) => {
            const count = oportunidades.filter((o: any) => o.etapa === etapa).length;
            const max = Math.max(...Object.keys(ETAPAS_LABEL).map(e => oportunidades.filter((o: any) => o.etapa === e).length), 1);
            const pct = Math.max((count / max) * 100, count > 0 ? 8 : 2);
            return (
              <div key={etapa} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-bold text-white">{count}</span>
                <div
                  className="w-full rounded-t-lg transition-all"
                  style={{ height: `${pct}%`, background: etapa === "FECHADO_GANHO" ? "rgb(16,185,129)" : etapa === "FECHADO_PERDIDO" ? "rgb(239,68,68)" : `rgba(${accent},0.6)` }}
                />
                <span className="text-[9px] text-slate-500 text-center leading-tight">{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Nova Oportunidade */}
      {showNovaOp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-white/10 p-6 space-y-4">
            <h3 className="font-bold text-white text-base">Nova Oportunidade</h3>
            <div className="space-y-3">
              <input
                autoFocus
                value={novaOp.titulo}
                onChange={e => setNovaOp(p => ({ ...p, titulo: e.target.value }))}
                placeholder="Título *"
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-white/30"
              />
              <input
                value={novaOp.empresa}
                onChange={e => setNovaOp(p => ({ ...p, empresa: e.target.value }))}
                placeholder="Empresa"
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-white/30"
              />
              <input
                value={novaOp.valor}
                onChange={e => setNovaOp(p => ({ ...p, valor: e.target.value }))}
                placeholder="Valor estimado (R$)"
                type="number"
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-white/30"
              />
              <select
                value={novaOp.etapa}
                onChange={e => setNovaOp(p => ({ ...p, etapa: e.target.value }))}
                className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/30"
              >
                {Object.entries(ETAPAS_LABEL).filter(([k]) => !k.startsWith("FECHADO")).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowNovaOp(false)}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-slate-400 hover:text-white transition-colors"
              >Cancelar</button>
              <button
                onClick={handleCriarOp}
                disabled={saving || !novaOp.titulo.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: `rgba(${accent},0.85)` }}
              >{saving ? "Salvando..." : "Criar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
