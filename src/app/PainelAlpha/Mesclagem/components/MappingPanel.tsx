"use client";

import { ArrowRight, Settings2, Sparkles } from "lucide-react";
import type { CampoMapeamento, ColunaPlanilha } from "@/lib/mesclagem";
import { StatusBadge } from "./StatusBadge";

interface MappingPanelProps {
  mapeamento: CampoMapeamento[];
  colunas: ColunaPlanilha[];
  onAtualizar: (destino: string, valor: number | null) => void;
  carregando?: boolean;
  erro?: string | null;
  usouIa?: boolean;
  onRetry?: () => void;
}

export function MappingPanel({ mapeamento, colunas, onAtualizar, carregando = false, erro, usouIa = false, onRetry }: MappingPanelProps) {
  const automaticos = mapeamento.filter((campo) => campo.automatico).length;
  const manuais = mapeamento.filter((campo) => campo.manual).length;
  const semOrigem = mapeamento.filter((campo) => campo.origem === null).length;
  const origensUsadas = new Set(mapeamento.flatMap((campo) => campo.origem === null ? [] : [campo.origem]));
  const colunasIgnoradas = colunas.filter((coluna) => !origensUsadas.has(coluna.numero)).length;

  return (
    <section className="rounded-2xl border border-indigo-400/15 bg-slate-900/80 p-5 shadow-xl backdrop-blur-xl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">3. Mapeamento de campos</h2>
          <p className="mt-1 text-sm text-slate-400">Conecte os campos do template oficial às colunas da planilha complementar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {carregando && <StatusBadge label="Calculando sugestões" variant="info" />}
          <StatusBadge label={`Mapeamento automático: ${automaticos}`} variant="info" icon="check" />
          {manuais > 0 && <StatusBadge label={`Alterado manualmente: ${manuais}`} variant="warn" icon="alert" />}
          {semOrigem > 0 && <StatusBadge label={`Sem origem: ${semOrigem}`} variant="warn" icon="alert" />}
          {colunasIgnoradas > 0 && <StatusBadge label={`Colunas não exportadas: ${colunasIgnoradas}`} variant="info" />}
        </div>
      </div>

      <div className="mt-4" aria-live="polite">
        {erro && (
          <div role="status" className="flex flex-col gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs text-amber-100 sm:flex-row sm:items-center sm:justify-between">
            <span>{erro} Você pode continuar ajustando os campos manualmente.</span>
            {onRetry && <button type="button" onClick={onRetry} className="rounded-lg border border-amber-300/25 px-3 py-2 font-bold hover:bg-amber-400/10">Tentar novamente</button>}
          </div>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
        <div className="max-h-[28rem] overflow-auto">
          <div className="grid gap-2 p-3 md:grid-cols-2">
            {mapeamento.map((campo) => (
              <div key={campo.destino} className="flex min-w-0 flex-col items-stretch gap-3 rounded-xl border border-white/10 bg-slate-950/45 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-slate-950/70 text-slate-400">
                    <Settings2 className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-100" title={campo.destino}>{campo.destino}</p>
                    <p className="truncate text-xs text-slate-500">
                      {campo.origemNome ? `Origem: ${campo.origemNome}` : "Sem origem selecionada"}
                    </p>
                    {campo.origemPrincipalNome && (
                      <p className="truncate text-[11px] text-slate-600" title={`Fallback da principal: ${campo.origemPrincipalNome}`}>
                        Fallback da principal: {campo.origemPrincipalNome}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex min-w-0 items-center gap-2">
                  <span className="hidden items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:flex">
                    <ArrowRight className="size-3" />
                    Origem
                  </span>
                  <select
                    value={campo.origem ?? ""}
                    onChange={(evento) => onAtualizar(campo.destino, evento.target.value ? Number(evento.target.value) : null)}
                    className="w-full min-w-0 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 transition hover:border-indigo-400/50 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/20 sm:w-48"
                    aria-label={`Origem para ${campo.destino}`}
                  >
                    <option value="">Vazio</option>
                    {colunas.map((coluna) => (
                      <option key={coluna.numero} value={coluna.numero}>{coluna.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-indigo-300" />
          Sugestões automáticas são recalculadas apenas para campos não alterados manualmente.
        </span>
        {usouIa && <span>IA local auxiliou apenas campos sem correspondência direta.</span>}
        {colunasIgnoradas > 0 && <span>Colunas sem destino no template oficial não serão incluídas no XLSX.</span>}
      </div>
    </section>
  );
}
