"use client";

import { useMemo, useState } from "react";
import { Search, Link2, GitBranch } from "lucide-react";
import type { PreviaMesclagem } from "@/lib/mesclagem";
import { StatusBadge } from "./StatusBadge";

function statusLinha(linha: PreviaMesclagem["resultado"]["linhas"][number]) {
  if (!linha.cnpj) return { label: "CNPJ inválido", variant: "error" as const, icon: "x" as const };
  if (linha.origemComplementar === null) return { label: "Apenas principal", variant: "warn" as const, icon: "alert" as const };
  return { label: "Combinado", variant: "ok" as const, icon: "check" as const };
}

export function MergePreview({ previa }: { previa: PreviaMesclagem }) {
  const [busca, setBusca] = useState("");
  const [limite, setLimite] = useState(50);

  const linhas = useMemo(() => {
    return previa.resultado.linhas
      .map((linha) => ({
        linha,
        status: statusLinha(linha),
        razao: linha.valores["Razão Social"] ?? "—",
      }))
      .filter(({ linha, razao }) => {
        const texto = `${linha.cnpj ?? ""} ${razao}`.toLowerCase();
        return !busca || texto.includes(busca.toLowerCase());
      });
  }, [busca, previa]);

  const visiveis = linhas.slice(0, limite);

  return (
    <section className="rounded-2xl border border-indigo-400/15 bg-slate-900/80 p-5 shadow-xl backdrop-blur-xl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Prévia compacta</h2>
          <p className="mt-1 text-sm text-slate-400">Visualize como os dados ficarão no arquivo final.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={`Mostrando ${visiveis.length} de ${linhas.length.toLocaleString("pt-BR")} linhas`} variant="info" />
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <input
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar CNPJ ou razão social"
              aria-label="Buscar CNPJ ou razão social na prévia"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2 pl-10 pr-3 text-sm text-slate-50 transition hover:border-indigo-400/50 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/20 sm:w-72"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-slate-500">
                <th className="sticky top-0 z-10 bg-slate-900/95 px-4 py-3 backdrop-blur">CNPJ</th>
                <th className="sticky top-0 z-10 bg-slate-900/95 px-4 py-3 backdrop-blur">Razão Social</th>
                <th className="sticky top-0 z-10 bg-slate-900/95 px-4 py-3 backdrop-blur">Linha principal</th>
                <th className="sticky top-0 z-10 bg-slate-900/95 px-4 py-3 backdrop-blur">Linha complementar</th>
                <th className="sticky top-0 z-10 bg-slate-900/95 px-4 py-3 backdrop-blur">Status</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    Nenhuma linha encontrada para a busca atual.
                  </td>
                </tr>
              ) : (
                visiveis.map(({ linha, status, razao }) => {
                  const ehGrupo = linha.cnpj && previa.resultado.linhas.filter((item) => item.cnpj === linha.cnpj).length > 1;
                  return (
                    <tr key={linha.id} className="border-t border-white/5 transition hover:bg-sky-500/5 motion-reduce:transition-none">
                      <td className="px-4 py-3 font-mono text-xs text-slate-300">
                        <span className="flex items-center gap-2">
                          {ehGrupo && <GitBranch className="size-3.5 text-violet-300" />}
                          {linha.cnpj ?? "—"}
                        </span>
                      </td>
                      <td className="max-w-64 truncate px-4 py-3 text-slate-200" title={razao}>{razao}</td>
                      <td className="px-4 py-3 text-slate-400">{linha.origemPrincipal}</td>
                      <td className="px-4 py-3 text-slate-400">{linha.origemComplementar ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge label={status.label} variant={status.variant} icon={status.icon} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {linhas.length > limite && (
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-2">
            <Link2 className="size-3.5" />
            Relações 1:N são preservadas visualmente com o marcador de grupo.
          </span>
          <button type="button" onClick={() => setLimite((atual) => atual + 50)} className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-1.5 font-semibold text-slate-300 hover:border-indigo-400/30">
            Carregar mais 50
          </button>
        </div>
      )}
    </section>
  );
}
