"use client";

import { useState } from "react";
import { Check, Loader2, RefreshCw } from "lucide-react";
import { calcularRetencoesFinanceiras } from "@/lib/bpm/pipeline-financeiro";

interface Props {
  valorBruto: number;
  aliquotaIrrf: number;
  aliquotaCsrf: number;
  regimePrestador?: string;
  regimeTomador?: string;
  servico?: string;
}

function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CalculoTributario({ valorBruto, aliquotaIrrf, aliquotaCsrf, regimePrestador, regimeTomador, servico }: Props) {
  const [recalculando, setRecalculando] = useState(false);
  const [recalculado, setRecalculado] = useState(false);
  const calc = calcularRetencoesFinanceiras(valorBruto, aliquotaIrrf, aliquotaCsrf, { regimePrestador, regimeTomador, servico });
  const consistente = calc.valorLiquido > 0;

  function recalcular() {
    setRecalculando(true);
    setTimeout(() => { setRecalculando(false); setRecalculado(true); }, 400);
  }

  const linhas: Array<[string, string]> = [
    ["Valor bruto", moeda(valorBruto)],
    ["IRRF", moeda(calc.valorIrrf)],
    ["CSRF", moeda(calc.valorCsrf)],
    ["Total de retenções", moeda(calc.totalRetencoes)],
    ["Valor líquido", moeda(calc.valorLiquido)],
  ];

  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-white">
          {consistente ? <Check size={14} className="text-emerald-400" aria-hidden="true" /> : <Loader2 size={14} className="text-slate-500" aria-hidden="true" />}
          Cálculo tributário
        </span>
        <button
          type="button"
          onClick={recalcular}
          disabled={recalculando}
          className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-60"
        >
          {recalculando ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={12} aria-hidden="true" />}
          Recalcular
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
        {linhas.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <dt className="text-slate-400">{k}</dt>
            <dd className="font-medium text-white">{v}</dd>
          </div>
        ))}
      </dl>
      <details className="text-[11px] text-slate-400">
        <summary className="cursor-pointer select-none font-medium text-slate-300">Memória de cálculo</summary>
        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-black/30 p-2 text-[10px] text-slate-300">{calc.memoriaCalculo}</pre>
      </details>
      <span className="sr-only" aria-live="polite">{recalculado ? "Cálculo recalculado" : ""}</span>
    </div>
  );
}
