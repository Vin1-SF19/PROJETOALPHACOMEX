"use client";

import { useMemo, useState } from "react";
import { Search, ScanSearch, CheckCircle2, XCircle, Copy, GitBranch } from "lucide-react";
import type { PreviaMesclagem } from "@/lib/mesclagem";
import { StatusBadge } from "./StatusBadge";

function formatarNumero(valor: number): string {
  return valor.toLocaleString("pt-BR");
}

function statusLinha(linha: PreviaMesclagem["resultado"]["linhas"][number]) {
  if (!linha.cnpj) return { label: "CNPJ inválido", variant: "error" as const, icon: "x" as const };
  if (linha.origemComplementar === null) return { label: "Apenas principal", variant: "warn" as const, icon: "alert" as const };
  return { label: "Combinado", variant: "ok" as const, icon: "check" as const };
}

export function CnpjDiagnostic({ previa }: { previa: PreviaMesclagem }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "valido" | "invalido" | "grupo-1n" | "sem-correspondencia">("todos");

  const exemplos = useMemo(() => {
    const contagemPorCnpj = new Map<string, number>();
    for (const linha of previa.resultado.linhas) {
      if (linha.cnpj) contagemPorCnpj.set(linha.cnpj, (contagemPorCnpj.get(linha.cnpj) ?? 0) + 1);
    }
    const linhas = previa.resultado.linhas.slice(0, 80);
    return linhas
      .map((linha) => {
        const cnpj = linha.cnpj ?? "";
        const normalizado = cnpj.replace(/\D/g, "");
        const status = statusLinha(linha);
        return {
          id: linha.id,
          valorOriginal: cnpj || "—",
          normalizado: normalizado || "—",
          status,
          grupo1N: Boolean(cnpj && (contagemPorCnpj.get(cnpj) ?? 0) > 1),
          observacao: linha.origemComplementar === null ? "Linha presente apenas na planilha principal." : "Linha combinada com a planilha complementar.",
        };
      })
      .filter((item) => {
        const texto = `${item.valorOriginal} ${item.normalizado} ${item.observacao}`.toLowerCase();
        if (busca && !texto.includes(busca.toLowerCase())) return false;
        if (filtro === "valido") return item.status.label === "Combinado" || item.status.label === "Apenas principal";
        if (filtro === "invalido") return item.status.label === "CNPJ inválido";
        if (filtro === "grupo-1n") return item.grupo1N;
        if (filtro === "sem-correspondencia") return item.status.label === "Apenas principal";
        return true;
      });
  }, [busca, filtro, previa]);

  const resumo = previa.resultado.resumo;

  const stats = [
    { label: "Linhas lidas", value: resumo.totalLinhas, tone: "text-slate-100", icon: ScanSearch },
    { label: "CNPJs válidos", value: resumo.cnpj.validos, tone: "text-emerald-300", icon: CheckCircle2 },
    { label: "Inválidos", value: resumo.cnpj.invalidos, tone: "text-rose-300", icon: XCircle },
    { label: "Duplicados", value: resumo.cnpj.duplicados, tone: "text-amber-300", icon: Copy },
    { label: "Sem correspondência", value: resumo.semMatch, tone: "text-violet-300", icon: GitBranch },
  ];

  return (
    <section className="rounded-2xl border border-indigo-400/15 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Diagnóstico dos CNPJs</h2>
          <p className="mt-1 text-sm text-slate-400">Valide os dados antes de gerar o arquivo final.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <input
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar CNPJ ou observação"
              aria-label="Buscar CNPJ ou observação"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 pl-10 pr-3 text-sm text-slate-50 transition hover:border-indigo-400/50 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/20 sm:w-72"
            />
          </div>
          <select aria-label="Filtrar diagnóstico de CNPJ" value={filtro} onChange={(evento) => setFiltro(evento.target.value as typeof filtro)} className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 transition hover:border-indigo-400/50 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/20">
            <option value="todos">Todos</option>
            <option value="valido">Válidos</option>
            <option value="invalido">Inválidos</option>
            <option value="grupo-1n">Grupos 1:N</option>
            <option value="sem-correspondencia">Sem correspondência</option>
          </select>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className={`text-2xl font-black ${stat.tone}`}>{formatarNumero(stat.value)}</span>
              <stat.icon className="size-5 text-slate-500" />
            </div>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-slate-500">
                <th className="sticky top-0 z-10 bg-slate-900/95 px-4 py-3 backdrop-blur">Valor original</th>
                <th className="sticky top-0 z-10 bg-slate-900/95 px-4 py-3 backdrop-blur">Normalizado</th>
                <th className="sticky top-0 z-10 bg-slate-900/95 px-4 py-3 backdrop-blur">Status</th>
                <th className="sticky top-0 z-10 bg-slate-900/95 px-4 py-3 backdrop-blur">Observação</th>
              </tr>
            </thead>
            <tbody>
              {exemplos.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                    Nenhum registro encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                exemplos.map((item) => (
                  <tr key={item.id} className="border-t border-white/5 transition hover:bg-sky-500/5 motion-reduce:transition-none">
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">{item.valorOriginal}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{item.normalizado}</td>
                    <td className="px-4 py-3">
                      <StatusBadge label={item.status.label} variant={item.status.variant} icon={item.status.icon} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      <span className="flex items-center gap-2">
                        {item.grupo1N && <GitBranch className="size-3.5 text-violet-300" />}
                        {item.grupo1N ? `Grupo 1:N. ${item.observacao}` : item.observacao}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
