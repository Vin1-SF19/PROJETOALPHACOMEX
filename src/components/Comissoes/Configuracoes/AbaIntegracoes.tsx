"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { formatarDataComissao } from "../lib/formatters";
import { ListarSyncRuns } from "@/actions/CommissionSync";

interface SyncErrorRow {
  id: string;
  sourceEntity: string;
  sourceId: string;
  mensagem: string;
}

interface SyncRunRow {
  id: string;
  sourceSystem: string;
  startedAt: Date;
  finishedAt: Date | null;
  status: string;
  triggeredBy: string;
  totalProcessed: number;
  totalErrors: number;
  erros: SyncErrorRow[];
}

const STATUS_COR: Record<string, string> = {
  SUCCESS: "text-emerald-400",
  RUNNING: "text-amber-400",
  PARTIAL: "text-amber-400",
  FAILED: "text-rose-400",
};

const STATUS_LABEL: Record<string, string> = {
  SUCCESS: "Concluída",
  RUNNING: "Em andamento",
  PARTIAL: "Parcial (com erros)",
  FAILED: "Falhou",
};

/** Histórico de sincronizações — somente leitura, sem Server Action de escrita necessária. */
export function AbaIntegracoes() {
  const [runs, setRuns] = useState<SyncRunRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const resultado = await ListarSyncRuns({ page: 1, pageSize: 25 });
    if (resultado.success) {
      setRuns(resultado.data as unknown as SyncRunRow[]);
      setErro(null);
    } else {
      setErro(resultado.error);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  if (carregando) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-5 animate-spin text-slate-500" aria-hidden="true" />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
        Não foi possível carregar o histórico de sincronizações. <code className="text-xs">{erro}</code>
      </div>
    );
  }

  if (runs.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">Nenhuma sincronização executada ainda.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Histórico das sincronizações com CS&amp;NPS/Metas/Colaboradores. Use o botão &quot;Sincronizar&quot; no
        cabeçalho de Comissões para disparar uma nova.
      </p>

      {runs.map((run) => (
        <div key={run.id} className="rounded-2xl border border-white/5 bg-slate-900/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-white">
                {run.sourceSystem} <span className="text-xs text-slate-500">({run.triggeredBy === "manual" ? "manual" : "agendada"})</span>
              </p>
              <p className="text-xs text-slate-500">{formatarDataComissao(run.startedAt)}</p>
            </div>
            <span className={`text-xs font-medium ${STATUS_COR[run.status] ?? "text-slate-400"}`}>
              {STATUS_LABEL[run.status] ?? run.status}
            </span>
          </div>

          <p className="mt-2 text-xs text-slate-400">
            {run.totalProcessed} processado(s)
            {run.totalErrors > 0 && `, ${run.totalErrors} erro(s)`}
          </p>

          {run.erros.length > 0 && (
            <ul className="mt-2 space-y-1 rounded-lg border border-rose-500/10 bg-rose-500/5 p-2 text-xs text-rose-300/80">
              {run.erros.map((e) => (
                <li key={e.id}>
                  {e.sourceEntity} ({e.sourceId}): {e.mensagem}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
