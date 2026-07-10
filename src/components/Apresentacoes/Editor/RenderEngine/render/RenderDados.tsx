import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type {
  GraficoComponente,
  TabelaComponente,
  KpiComponente,
  ProgressoComponente,
  RoadmapComponente,
  ComparacaoComponente,
  FaqComponente,
  ChecklistComponente,
} from "@/lib/validations/slide-componentes";

const CORES_PIZZA = ["#4f46e5", "#818cf8", "#c7d2fe", "#3730a3", "#a5b4fc"];

export function RenderGrafico({ componente }: { componente: GraficoComponente }) {
  const cor = componente.corPrimaria ?? "#4f46e5";
  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        {componente.tipoGrafico === "linha" ? (
          <LineChart data={componente.dados}>
            <XAxis dataKey="label" stroke="#64748b" fontSize={11} />
            <YAxis stroke="#64748b" fontSize={11} />
            <Line type="monotone" dataKey="valor" stroke={cor} strokeWidth={2} dot={{ fill: cor }} />
          </LineChart>
        ) : componente.tipoGrafico === "pizza" ? (
          <PieChart>
            <Pie data={componente.dados} dataKey="valor" nameKey="label" cx="50%" cy="50%" outerRadius="80%">
              {componente.dados.map((_, i) => (
                <Cell key={i} fill={CORES_PIZZA[i % CORES_PIZZA.length]} />
              ))}
            </Pie>
          </PieChart>
        ) : (
          <BarChart data={componente.dados}>
            <XAxis dataKey="label" stroke="#64748b" fontSize={11} />
            <YAxis stroke="#64748b" fontSize={11} />
            <Bar dataKey="valor" fill={cor} radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function RenderTabela({ componente }: { componente: TabelaComponente }) {
  return (
    <table className="h-full w-full border-collapse text-left text-sm text-slate-200">
      <thead>
        <tr style={{ background: componente.corCabecalho ?? "#1e293b" }}>
          {componente.colunas.map((col, i) => (
            <th key={i} className="border border-white/10 px-3 py-2 font-semibold">{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {componente.linhas.map((linha, i) => (
          <tr key={i}>
            {linha.map((celula, j) => (
              <td key={j} className="border border-white/10 px-3 py-2">{celula}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RenderKpi({ componente }: { componente: KpiComponente }) {
  const positivo = (componente.variacao ?? 0) >= 0;
  return (
    <div className="flex h-full w-full flex-col justify-center gap-1 rounded-2xl bg-slate-900/60 p-4">
      <span className="text-3xl font-bold text-white">{componente.valor}</span>
      <span className="text-xs text-slate-400">{componente.label}</span>
      {componente.variacao !== undefined && (
        <span className={`text-xs font-medium ${positivo ? "text-emerald-400" : "text-red-400"}`}>
          {positivo ? "▲" : "▼"} {Math.abs(componente.variacao)}%
        </span>
      )}
    </div>
  );
}

export function RenderProgresso({ componente }: { componente: ProgressoComponente }) {
  const cor = componente.cor ?? "#4f46e5";
  return (
    <div className="flex h-full w-full flex-col justify-center gap-1.5">
      {componente.label && <span className="text-xs text-slate-400">{componente.label}</span>}
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full" style={{ width: `${componente.percentual}%`, background: cor }} />
      </div>
    </div>
  );
}

export function RenderRoadmap({ componente }: { componente: RoadmapComponente }) {
  const vertical = componente.orientacao === "vertical";
  return (
    <div className={`flex h-full w-full gap-4 overflow-auto ${vertical ? "flex-col" : "flex-row items-start"}`}>
      {componente.itens.map((item, i) => (
        <div key={i} className="flex min-w-[120px] flex-1 flex-col gap-1 border-l-2 border-indigo-500 pl-3">
          <span className="text-xs text-slate-500">{item.data}</span>
          <span className={`text-sm font-medium ${item.concluido ? "text-emerald-400" : "text-white"}`}>{item.titulo}</span>
          {item.descricao && <span className="text-xs text-slate-400">{item.descricao}</span>}
        </div>
      ))}
    </div>
  );
}

export function RenderComparacao({ componente }: { componente: ComparacaoComponente }) {
  return (
    <div className="flex h-full w-full gap-3">
      {componente.colunas.map((col, i) => (
        <div
          key={i}
          className={`flex flex-1 flex-col gap-2 rounded-xl p-4 ${col.destaque ? "bg-indigo-600/20 ring-1 ring-indigo-500/50" : "bg-slate-900/60"}`}
        >
          <span className="text-sm font-bold text-white">{col.titulo}</span>
          {col.itens.map((item, j) => (
            <span key={j} className="text-xs text-slate-300">{item}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function RenderFaq({ componente }: { componente: FaqComponente }) {
  const [abertoIndex, setAbertoIndex] = useState<number | null>(0);
  return (
    <div className="flex h-full w-full flex-col gap-2 overflow-auto">
      {componente.itens.map((item, i) => {
        const aberto = abertoIndex === i;
        return (
          <div key={i} className="rounded-lg bg-slate-900/60">
            <button
              type="button"
              onClick={() => setAbertoIndex(aberto ? null : i)}
              aria-expanded={aberto}
              className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm font-medium text-white"
            >
              {item.pergunta}
              <ChevronDown size={14} className={aberto ? "rotate-180" : ""} aria-hidden="true" />
            </button>
            {aberto && <p className="px-3 pb-2 text-xs text-slate-400">{item.resposta}</p>}
          </div>
        );
      })}
    </div>
  );
}

export function RenderChecklist({ componente }: { componente: ChecklistComponente }) {
  return (
    <div className="flex h-full w-full flex-col gap-2 overflow-auto">
      {componente.itens.map((item, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${item.concluido ? "border-emerald-500 bg-emerald-500/20 text-emerald-400" : "border-white/20"}`}
          >
            {item.concluido ? "✓" : ""}
          </span>
          <span className={item.concluido ? "text-slate-500 line-through" : "text-slate-200"}>{item.texto}</span>
        </div>
      ))}
    </div>
  );
}
