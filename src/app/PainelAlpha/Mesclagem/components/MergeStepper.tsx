"use client";

import { CheckCircle2, AlertTriangle } from "lucide-react";

interface MergeStepperProps {
  etapa: number;
  erroEtapa?: number | null;
}

const ETAPAS = [
  { numero: 1, titulo: "Arquivos", descricao: "Envie as planilhas" },
  { numero: 2, titulo: "CNPJ", descricao: "Configure as colunas" },
  { numero: 3, titulo: "Mapeamento", descricao: "Ajuste as relações" },
  { numero: 4, titulo: "Revisão e exportação", descricao: "Valide e baixe" },
];

export function MergeStepper({ etapa, erroEtapa = null }: MergeStepperProps) {
  return (
    <ol className="grid gap-3 md:grid-cols-4" aria-label="Etapas da mesclagem">
      {ETAPAS.map((item, indice) => {
        const ativo = etapa === item.numero;
        const concluido = etapa > item.numero;
        const erro = erroEtapa === item.numero;
        const estado = erro
          ? "border-rose-400/50 bg-rose-950/70"
          : ativo
            ? "border-sky-400/70 bg-slate-800 shadow-xl ring-2 ring-sky-400/15"
            : concluido
              ? "border-emerald-400/40 bg-emerald-950/40"
              : "border-white/10 bg-slate-950/45";

        return (
          <li key={item.numero} aria-current={ativo ? "step" : undefined} className={`relative rounded-2xl border p-4 transition-all duration-300 ${estado}`}>
            <div className="flex items-center gap-3">
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-black ${erro ? "border-rose-400/40 bg-rose-500/10 text-rose-200" : ativo ? "border-indigo-400/50 bg-indigo-500/15 text-indigo-100" : concluido ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "border-white/10 bg-slate-950/60 text-slate-500"}`}>
                {concluido ? <CheckCircle2 className="size-4" /> : erro ? <AlertTriangle className="size-4" /> : item.numero}
              </span>
              <div className="min-w-0">
                <p className={`truncate text-sm font-bold ${ativo ? "text-white" : concluido ? "text-emerald-100" : erro ? "text-rose-100" : "text-slate-400"}`}>{item.titulo}</p>
                <p className="truncate text-[11px] text-slate-500">{item.descricao}</p>
              </div>
            </div>
            {indice < ETAPAS.length - 1 && (
              <span className="absolute -right-2 top-1/2 hidden h-px w-4 bg-gradient-to-r from-indigo-400/40 to-transparent md:block" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
