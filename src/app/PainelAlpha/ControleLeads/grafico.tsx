"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { BarChart3, Calendar, Filter, LayoutDashboard } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const CANAIS = [
  { id: "TRAFEGO_PAGO", nome: "Tráfego Pago", cor: "#22c55e" },
  { id: "CALLIX", nome: "Callix", cor: "#3b82f6" },
  { id: "INDICACAO", nome: "Indicação", cor: "#f97316" },
  { id: "EVENTOS", nome: "Eventos", cor: "#8b5cf6" },
  { id: "CHINA", nome: "China", cor: "#ef4444" },
] as const;

type CanalId = (typeof CANAIS)[number]["id"];
type FiltroCanal = CanalId | "GERAL";
type Metricas = {
  leads: number;
  leadsDesqualificados: number;
  agendadas: number;
  realizadas: number;
  noShow: number;
  habilitacao: number;
  revisao: number;
  HotLeadsHabilitacao: number;
  HotLeadsRevisao: number;
};

const VAZIO: Metricas = {
  leads: 0, leadsDesqualificados: 0, agendadas: 0, realizadas: 0,
  noShow: 0, habilitacao: 0, revisao: 0,
  HotLeadsHabilitacao: 0, HotLeadsRevisao: 0,
};

function numero(valor: unknown) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? Math.max(0, convertido) : 0;
}

function normalizarMetricas(valor: Partial<Metricas> | undefined): Metricas {
  return Object.fromEntries(
    Object.keys(VAZIO).map((chave) => [chave, numero(valor?.[chave as keyof Metricas])]),
  ) as Metricas;
}

function somarMetricas(valores: Metricas[]): Metricas {
  return valores.reduce((total, atual) => {
    for (const chave of Object.keys(VAZIO) as Array<keyof Metricas>) total[chave] += atual[chave];
    return total;
  }, { ...VAZIO });
}

export default function Grafico({ dadosAcumulados }: { dadosAcumulados?: { canais?: Partial<Record<CanalId, Partial<Metricas>>> } | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canalParametro = searchParams.get("canal_grafico");
  const canalSelecionado: FiltroCanal = canalParametro === "GERAL" || CANAIS.some(({ id }) => id === canalParametro)
    ? canalParametro as FiltroCanal
    : "GERAL";
  const mesParametro = Number(searchParams.get("mes") ?? new Date().getMonth());
  const mes = Number.isInteger(mesParametro) && mesParametro >= 0 && mesParametro <= 11 ? mesParametro : new Date().getMonth();

  const canais = Object.fromEntries(
    CANAIS.map(({ id }) => [id, normalizarMetricas(dadosAcumulados?.canais?.[id])]),
  ) as Record<CanalId, Metricas>;
  const geral = somarMetricas(Object.values(canais));
  const canaisVisiveis = canalSelecionado === "GERAL"
    ? CANAIS
    : CANAIS.filter(({ id }) => id === canalSelecionado);
  const detalhamentos = canalSelecionado === "GERAL"
    ? [{ id: "GERAL", nome: "Geral", cor: "#64748b", metricas: geral }, ...CANAIS.map((canal) => ({ ...canal, metricas: canais[canal.id] }))]
    : canaisVisiveis.map((canal) => ({ ...canal, metricas: canais[canal.id] }));

  const alterarParametro = (chave: string, valor: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(chave, valor);
    if (chave === "mes") {
      const ano = Number(params.get("ano") ?? new Date().getFullYear());
      params.set("data", `${ano}-${String(Number(valor) + 1).padStart(2, "0")}-01`);
    }
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const dadosPorMetrica = (chave: keyof Metricas) => canaisVisiveis.map((canal) => ({
    name: canal.nome,
    value: canais[canal.id][chave],
    valor: canais[canal.id][chave],
    color: canal.cor,
    fill: canal.cor,
  }));

  return (
    <div className="min-h-screen space-y-8 p-6 pb-20 text-slate-200">
      <header className="flex flex-col items-center justify-between rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-2xl backdrop-blur-md lg:flex-row">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
            <LayoutDashboard className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight text-white">Gráficos de Leads Alpha</h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400">{MESES[mes]} / {canalSelecionado.replaceAll("_", " ")}</p>
          </div>
        </div>
        <div className="mt-4 flex gap-3 lg:mt-0">
          <SelectFiltro
            label="Canal dos gráficos"
            value={canalSelecionado}
            onChange={(valor) => alterarParametro("canal_grafico", valor)}
            options={[{ label: "Geral", value: "GERAL" }, ...CANAIS.map(({ id, nome }) => ({ label: nome, value: id }))]}
            icon={<Filter size={14} />}
          />
          <SelectFiltro
            label="Mês dos gráficos"
            value={String(mes)}
            onChange={(valor) => alterarParametro("mes", valor)}
            options={MESES.map((nome, indice) => ({ label: nome, value: String(indice) }))}
            icon={<Calendar size={14} />}
          />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <CardGraficoContainer titulo="Origem — novos leads"><GraficoRosca data={dadosPorMetrica("leads")} /></CardGraficoContainer>
        <CardGraficoContainer titulo="Origem — contratos habilitação"><GraficoRosca data={dadosPorMetrica("habilitacao")} /></CardGraficoContainer>
        <CardGraficoContainer titulo="Origem — contratos revisão"><GraficoRosca data={dadosPorMetrica("revisao")} /></CardGraficoContainer>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <CardGraficoContainer titulo="Novos leads por canal"><GraficoBarras data={dadosPorMetrica("leads")} /></CardGraficoContainer>
        <CardGraficoContainer titulo="Habilitação por canal"><GraficoBarras data={dadosPorMetrica("habilitacao")} /></CardGraficoContainer>
        <CardGraficoContainer titulo="Revisão por canal"><GraficoBarras data={dadosPorMetrica("revisao")} /></CardGraficoContainer>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {detalhamentos.map(({ id, nome, metricas }) => (
          <CardGraficoContainer key={id} titulo={`Detalhamento — ${nome}`}>
            <GraficoBarras data={[
              { name: "Leads", valor: metricas.leads, color: "#3b82f6" },
              { name: "Desqualif.", valor: metricas.leadsDesqualificados, color: "#e11d48" },
              { name: "Agendas", valor: metricas.agendadas, color: "#8b5cf6" },
              { name: "Realizadas", valor: metricas.realizadas, color: "#10b981" },
              { name: "No show", valor: metricas.noShow, color: "#f43f5e" },
              { name: "Hab.", valor: metricas.habilitacao, color: "#fbbf24" },
              { name: "Revisão", valor: metricas.revisao, color: "#f97316" },
              { name: "Hot Hab.", valor: metricas.HotLeadsHabilitacao, color: "#06b6d4" },
              { name: "Hot Rev.", valor: metricas.HotLeadsRevisao, color: "#ec4899" },
            ]} />
          </CardGraficoContainer>
        ))}
      </div>

      <CardGraficoContainer titulo={`Funil de conversão — ${canalSelecionado === "GERAL" ? "geral" : canaisVisiveis[0].nome}`}>
        <div className="flex h-full flex-col justify-center space-y-5 px-4 py-8 sm:px-10">
          <BarraProgresso label="Leads qualificados → agendas" atual={(canalSelecionado === "GERAL" ? geral : canais[canalSelecionado]).agendadas} total={Math.max(0, (canalSelecionado === "GERAL" ? geral : canais[canalSelecionado]).leads - (canalSelecionado === "GERAL" ? geral : canais[canalSelecionado]).leadsDesqualificados)} cor="bg-purple-500" />
          <BarraProgresso label="Agendas → realizadas" atual={(canalSelecionado === "GERAL" ? geral : canais[canalSelecionado]).realizadas} total={(canalSelecionado === "GERAL" ? geral : canais[canalSelecionado]).agendadas} cor="bg-indigo-500" />
          <BarraProgresso label="Realizadas → contratos" atual={(canalSelecionado === "GERAL" ? geral : canais[canalSelecionado]).habilitacao + (canalSelecionado === "GERAL" ? geral : canais[canalSelecionado]).revisao} total={(canalSelecionado === "GERAL" ? geral : canais[canalSelecionado]).realizadas} cor="bg-emerald-500" />
        </div>
      </CardGraficoContainer>
    </div>
  );
}

function CardGraficoContainer({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex min-h-[350px] flex-col rounded-[2rem] border border-slate-800 bg-slate-900/40 p-6 shadow-xl">
      <div className="mb-6 flex items-center gap-2"><BarChart3 size={14} className="text-blue-500" /><h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{titulo}</h2></div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

function GraficoRosca({ data }: { data: Array<{ name: string; value: number; color: string }> }) {
  const total = data.reduce((soma, item) => soma + numero(item.value), 0);
  return (
    <div className="relative h-full min-h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} innerRadius={60} outerRadius={85} paddingAngle={total > 0 ? 5 : 0} dataKey="value" stroke="none">{data.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip contentStyle={TOOLTIP_STYLE} /></PieChart></ResponsiveContainer>
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center"><p className="text-[8px] font-black uppercase text-slate-500">Total</p><p className="text-xl font-black text-white">{total}</p></div>
    </div>
  );
}

function GraficoBarras({ data }: { data: Array<{ name: string; valor: number; color: string }> }) {
  return (
    <div className="h-[300px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}><CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} /><XAxis dataKey="name" axisLine={false} tickLine={false} interval={0} tick={{ fontSize: 9, fontWeight: 700, fill: "#94a3b8" }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#94a3b8" }} /><Tooltip cursor={{ fill: "rgba(255,255,255,0.05)" }} contentStyle={TOOLTIP_STYLE} /><Bar dataKey="valor" radius={[8, 8, 0, 0]} barSize={42}>{data.map((item) => <Cell key={item.name} fill={item.color} />)}</Bar></BarChart></ResponsiveContainer></div>
  );
}

const TOOLTIP_STYLE = { backgroundColor: "#1e293b", border: "none", borderRadius: "12px", fontSize: "11px", color: "#fff" };

function BarraProgresso({ label, atual, total, cor }: { label: string; atual: number; total: number; cor: string }) {
  const percentualReal = total > 0 ? (atual / total) * 100 : 0;
  const largura = Math.min(100, Math.max(0, percentualReal));
  return (
    <div className="space-y-1"><div className="flex justify-between gap-4 text-[9px] font-black uppercase tracking-widest"><span className="text-slate-400">{label}</span><span className="text-white">{atual}/{total} ({percentualReal.toFixed(1)}%)</span></div><div className="h-2 w-full overflow-hidden rounded-full bg-slate-800"><div className={`h-full ${cor} transition-all duration-1000`} style={{ width: `${largura}%` }} /></div></div>
  );
}

function SelectFiltro({ label, value, onChange, options, icon }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }>; icon: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-black text-white"><span className="sr-only">{label}</span>{icon}<select value={value} onChange={(evento) => onChange(evento.target.value)} className="cursor-pointer bg-transparent uppercase outline-none">{options.map((opcao) => <option key={opcao.value} value={opcao.value} className="bg-slate-800">{opcao.label}</option>)}</select></label>
  );
}
