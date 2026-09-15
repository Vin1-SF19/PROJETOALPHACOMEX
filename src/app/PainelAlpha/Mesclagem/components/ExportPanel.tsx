"use client";

import Link from "next/link";
import { ArrowRight, FileOutput, Loader2, Download, CheckCircle2 } from "lucide-react";
import type { PreviaMesclagem } from "@/lib/mesclagem";
import { StatusBadge } from "./StatusBadge";

interface ExportPanelProps {
  previa: PreviaMesclagem;
  processando: boolean;
  gerado: boolean;
  historicoId?: string | null;
  onExport: () => void;
  onRestart: () => void;
}

export function ExportPanel({ previa, processando, gerado, historicoId, onExport, onRestart }: ExportPanelProps) {
  const resumo = previa.resultado.resumo;

  const stats = [
    { label: "Empresas processadas", value: resumo.comMatch + resumo.semMatch },
    { label: "CNPJs correspondentes", value: resumo.comMatch },
    { label: "Sem correspondência", value: resumo.semMatch },
    { label: "Linhas finais", value: resumo.totalLinhas },
  ];

  return (
    <section className="rounded-2xl border border-indigo-400/15 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Exportação</h2>
          <p className="mt-1 text-sm text-slate-400">Gere a planilha final utilizando o template oficial.</p>
        </div>
        <StatusBadge label={gerado ? "Pronto para download" : "Aguardando exportação"} variant={gerado ? "ok" : "info"} icon={gerado ? "check" : null} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
            <span className="block text-2xl font-black text-white">{stat.value.toLocaleString("pt-BR")}</span>
            <span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-xl border border-white/10 bg-slate-950/45 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-500/10 text-rose-200">
            <FileOutput className="size-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-100">Resumo da operação</p>
            <p className="text-xs text-slate-400">
              Todas as empresas da principal são exportadas; correspondências 1:N geram uma linha por registro complementar.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={onRestart} disabled={processando} className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-slate-950/60 px-5 py-3 text-sm font-bold text-slate-200 hover:border-indigo-400/30 disabled:opacity-50">
            Nova mesclagem
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={processando}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 via-violet-600 to-rose-500 px-5 py-3 text-sm font-black text-white shadow-xl transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
          >
            {processando ? <Loader2 className="size-4 animate-spin" /> : gerado ? <CheckCircle2 className="size-4" /> : <Download className="size-4" />}
            {processando ? "Gerando planilha..." : gerado ? "Baixar arquivo" : "GERAR PLANILHA FINAL"}
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <ArrowRight className="size-3.5" />
        O XLSX contém {resumo.totalLinhas.toLocaleString("pt-BR")} linhas completas, incluindo {resumo.semMatch.toLocaleString("pt-BR")} sem correspondência; a prévia visual não limita a exportação.
        {historicoId && <Link href={`/PainelAlpha/Mesclagem/${historicoId}`} className="ml-auto font-bold text-indigo-300 hover:text-indigo-200">Ver no histórico</Link>}
      </div>
    </section>
  );
}
