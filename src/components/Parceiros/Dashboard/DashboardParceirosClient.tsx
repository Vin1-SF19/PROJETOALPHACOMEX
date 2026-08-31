"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Users, UserPlus, Flame, Repeat, UserX, AlertTriangle,
  TrendingUp, DollarSign, Percent, Target, Bell, ListTodo, CheckCircle2, ListChecks,
} from "lucide-react";
import { getTema } from "@/lib/temas";
import type { ObterDashboardCanaisParcerias, ListarFilaFollowUpParceiros, ListarAlertasParceiros } from "@/actions/parceiros-dashboard";
import { CriarTarefaParceiro } from "@/actions/parceiros-tarefas";

type DashboardData = Awaited<ReturnType<typeof ObterDashboardCanaisParcerias>>;
type ItemFila = Awaited<ReturnType<typeof ListarFilaFollowUpParceiros>>["itens"][number];
type Alerta = Awaited<ReturnType<typeof ListarAlertasParceiros>>["alertas"][number];

const ALERTA_LABEL: Record<Alerta["tipo"], string> = {
  SEM_PROXIMA_ACAO: "Sem próxima ação",
  FOLLOWUP_VENCIDO: "Follow-up vencido",
  PARCEIRO_INATIVO: "Parceiro inativo",
  CADASTRO_PENDENTE: "Cadastro pendente",
  SEM_INDICACAO: "Sem indicação",
};

function StatCard({ icon, label, valor, cor }: { icon: React.ReactNode; label: string; valor: string | number; cor: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(15,23,42,0.6)", border: `1px solid rgba(${cor},0.25)` }}>
      <div className="flex items-center gap-2 text-slate-400 mb-2" style={{ color: `rgb(${cor})` }}>
        {icon}
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-2xl font-black text-slate-100">{valor}</p>
    </div>
  );
}

function MiniBarSeries({ dados, cor }: { dados: { mes: string; total: number }[]; cor: string }) {
  const max = Math.max(1, ...dados.map((d) => d.total));
  return (
    <div className="flex items-end gap-2 h-24">
      {dados.map((d) => (
        <div key={d.mes} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full rounded-t-md transition-all" style={{ height: `${(d.total / max) * 100}%`, minHeight: 2, background: `rgba(${cor},0.6)` }} title={`${d.mes}: ${d.total}`} />
          <span className="text-[9px] text-slate-500">{d.mes}</span>
        </div>
      ))}
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-[13px] font-black uppercase tracking-widest text-slate-300 mb-3">
      {icon} {children}
    </h2>
  );
}

export default function DashboardParceirosClient({
  temaName,
  dashboardInicial,
  filaInicial,
  alertasIniciais,
  tarefasPendentesPorParceiro,
  alertasComTarefaAutomatica,
}: {
  temaName: string;
  dashboardInicial: DashboardData | null;
  filaInicial: ItemFila[];
  alertasIniciais: Alerta[];
  tarefasPendentesPorParceiro: Record<number, number>;
  alertasComTarefaAutomatica: string[];
}) {
  const tema = getTema(temaName);
  const accent = tema.accent;
  const [isPending, startTransition] = useTransition();
  const [dashboard] = useState(dashboardInicial);
  const [fila] = useState(filaInicial);
  const [alertas] = useState(alertasIniciais);
  const [tarefaAutomaticaChaves, setTarefaAutomaticaChaves] = useState(new Set(alertasComTarefaAutomatica));
  const [criandoTarefaKey, setCriandoTarefaKey] = useState<string | null>(null);

  function criarTarefaDoAlerta(a: Alerta) {
    const parceiroId = a.parceiroId;
    if (!parceiroId) return;
    const key = `${parceiroId}:${a.tipo}`;
    setCriandoTarefaKey(key);
    startTransition(async () => {
      const r = await CriarTarefaParceiro({
        parceiroId,
        titulo: `${ALERTA_LABEL[a.tipo]} — ${a.nome}`,
        descricao: a.detalhe,
        prioridade: "ALTA",
      });
      setCriandoTarefaKey(null);
      if (!r.success) { toast.error(r.error); return; }
      setTarefaAutomaticaChaves((prev) => new Set(prev).add(key));
      toast.success("Tarefa criada");
    });
  }

  const ind = dashboard?.success ? dashboard.indicadores : null;
  const evolucao = dashboard?.success ? dashboard.evolucao : null;

  return (
    <div className="min-h-screen w-full" style={{ background: "#05070d" }}>
      <header className="px-6 py-5 flex items-center gap-3 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div>
          <h1 className="text-lg font-black text-slate-100">Dashboard</h1>
          <p className="text-[11px] text-slate-500">Aquisição, desenvolvimento e indicações — últimos {dashboard?.success ? dashboard.periodoDias : 30} dias</p>
        </div>
        {isPending && <span className="ml-auto text-[10px] text-slate-500">Atualizando...</span>}
      </header>

      <div className="p-6 space-y-8">
        {/* ── Visão Geral ── */}
        <section>
          <SectionTitle icon={<TrendingUp size={14} />}>Visão Geral</SectionTitle>
          {!ind ? (
            <p className="text-slate-500 text-sm">Sem dados disponíveis.</p>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={<UserPlus size={16} />} label="Funil de Aquisição" valor={ind.parceirosNoFunilAquisicao} cor="234,179,8" />
                <StatCard icon={<Users size={16} />} label="Novos Parceiros" valor={ind.novosParceiros} cor={accent} />
                <StatCard icon={<Flame size={16} />} label="Ativos" valor={ind.ativos} cor="16,185,129" />
                <StatCard icon={<Repeat size={16} />} label="Recorrentes" valor={ind.recorrentes} cor="139,92,246" />
                <StatCard icon={<UserX size={16} />} label="Inativos" valor={ind.inativos} cor="100,116,139" />
                <StatCard icon={<AlertTriangle size={16} />} label="Sem Indicação (prazo)" valor={ind.semIndicacaoAcimaDoPrazo} cor="239,68,68" />
                <StatCard icon={<Target size={16} />} label="Indicações no Período" valor={ind.indicacoesNoPeriodo} cor={accent} />
                <StatCard icon={<Percent size={16} />} label="Conversão" valor={`${(ind.conversaoNoPeriodo * 100).toFixed(1)}%`} cor="16,185,129" />
                <StatCard icon={<TrendingUp size={16} />} label="Contratos Originados" valor={ind.contratosOriginadosNoPeriodo} cor={accent} />
                <StatCard icon={<DollarSign size={16} />} label="Receita Originada" valor={ind.receitaOriginadaNoPeriodo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} cor="16,185,129" />
              </div>

              {evolucao && (
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="rounded-2xl p-4" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Evolução — Aquisição</p>
                    <MiniBarSeries dados={evolucao.aquisicao} cor="234,179,8" />
                  </div>
                  <div className="rounded-2xl p-4" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Evolução — Ativação</p>
                    <MiniBarSeries dados={evolucao.ativacao} cor="16,185,129" />
                  </div>
                  <div className="rounded-2xl p-4" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Evolução — Recorrência</p>
                    <MiniBarSeries dados={evolucao.recorrencia} cor="139,92,246" />
                  </div>
                </div>
              )}

              {/* Alertas — fundidos na Visão Geral (não é mais aba própria) */}
              <div>
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                  <Bell size={12} /> Alertas {alertas.length > 0 && `(${alertas.length})`}
                </p>
                {alertas.length === 0 ? (
                  <p className="text-slate-500 text-sm flex items-center gap-2"><Bell size={14} /> Nenhum alerta no momento.</p>
                ) : (
                  <div className="space-y-2">
                    {alertas.map((a, i) => {
                      const key = a.parceiroId ? `${a.parceiroId}:${a.tipo}` : null;
                      const temTarefa = key ? tarefaAutomaticaChaves.has(key) : false;
                      return (
                        <div key={i} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
                          <AlertTriangle size={15} className="text-red-400 shrink-0" />
                          <div className="flex-1">
                            <p className="text-[12px] font-bold text-slate-200">{ALERTA_LABEL[a.tipo]} — {a.nome}</p>
                            <p className="text-[10px] text-slate-500">{a.detalhe}</p>
                          </div>
                          {a.parceiroId && (
                            temTarefa ? (
                              <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black shrink-0" style={{ background: "rgba(255,255,255,0.08)", color: "rgb(148,163,184)" }}>
                                <CheckCircle2 size={11} /> Tarefa criada
                              </span>
                            ) : (
                              <button
                                onClick={() => criarTarefaDoAlerta(a)}
                                disabled={isPending && criandoTarefaKey === key}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black shrink-0 disabled:opacity-50"
                                style={{ background: `rgba(${accent},0.15)`, color: `rgb(${accent})` }}
                              >
                                <ListTodo size={12} /> {isPending && criandoTarefaKey === key ? "Criando..." : "Criar tarefa"}
                              </button>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ── Fila de Follow-up ── */}
        <section>
          <SectionTitle icon={<ListChecks size={14} />}>Fila de Follow-up {fila.length > 0 && `(${fila.length})`}</SectionTitle>
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <th className="px-4 py-3">Parceiro</th>
                  <th className="px-4 py-3">Potencial</th>
                  <th className="px-4 py-3">Última Indicação</th>
                  <th className="px-4 py-3">Dias sem indicação</th>
                  <th className="px-4 py-3">Próxima ação</th>
                  <th className="px-4 py-3">Prioridade</th>
                  <th className="px-4 py-3">Tarefas</th>
                </tr>
              </thead>
              <tbody>
                {fila.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Nenhum parceiro na fila.</td></tr>
                ) : fila.map((item) => {
                  const qtdTarefas = tarefasPendentesPorParceiro[item.parceiroId] ?? 0;
                  return (
                  <tr key={item.parceiroId} className="border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                    <td className="px-4 py-3 text-slate-200 font-bold">{item.nome}</td>
                    <td className="px-4 py-3 text-slate-400">{item.potencialRecorrencia ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-400">{item.ultimaIndicacaoEm ? new Date(item.ultimaIndicacaoEm).toLocaleDateString("pt-BR") : "Nunca"}</td>
                    <td className="px-4 py-3 text-slate-400">{item.diasSemIndicacao ?? "—"}</td>
                    <td className="px-4 py-3">
                      {item.followUpVencido ? (
                        <span className="text-red-400 font-bold">Vencido</span>
                      ) : item.proximaAcaoEm ? (
                        new Date(item.proximaAcaoEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
                      ) : (
                        <span className="text-amber-400">Sem próxima ação</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-lg text-[10px] font-black" style={{ background: `rgba(${accent},0.15)`, color: `rgb(${accent})` }}>
                        {item.prioridade}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-1 rounded-lg text-[10px] font-black"
                        style={qtdTarefas > 0 ? { background: `rgba(${accent},0.15)`, color: `rgb(${accent})` } : { background: "rgba(255,255,255,0.05)", color: "rgb(100,116,139)" }}
                      >
                        {qtdTarefas} pendente{qtdTarefas === 1 ? "" : "s"}
                      </span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
