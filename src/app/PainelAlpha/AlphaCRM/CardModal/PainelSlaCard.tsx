"use client";

import { Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ObterStatusSlaCard } from "@/actions/bpm/Sla";
import { Button } from "@/components/ui/button";
import { SlaStatusBadge } from "@/components/bpm/sla/SlaStatusBadge";

type ResultadoSla = Awaited<ReturnType<typeof ObterStatusSlaCard>>;
type ItemSla = NonNullable<ResultadoSla["data"]>[number];

function dataHora(valor: Date | string | null) {
  if (!valor) return "Sem prazo final";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(valor));
}

export function PainelSlaCard({ cardId, realtimeRevision }: { cardId: string; realtimeRevision: number }) {
  const [itens, setItens] = useState<ItemSla[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const aplicarResultado = useCallback((resultado: ResultadoSla) => {
    if (resultado.success && resultado.data) {
      setItens(resultado.data.filter((item) => item.status !== "CONCLUIDO"));
      setErro(null);
    } else {
      setErro(typeof resultado.error === "string" ? resultado.error : "Erro ao consultar SLA");
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    let cancelado = false;
    void ObterStatusSlaCard(cardId).then((resultado) => {
      if (!cancelado) aplicarResultado(resultado);
    });
    return () => { cancelado = true; };
  }, [aplicarResultado, cardId, realtimeRevision]);

  const carregar = useCallback(async () => {
    aplicarResultado(await ObterStatusSlaCard(cardId));
  }, [aplicarResultado, cardId]);

  if (!carregando && !erro && itens.length === 0) return null;

  return (
    <section aria-labelledby={`sla-card-${cardId}`} className="rounded-2xl border border-white/[0.07] bg-slate-950/45 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id={`sla-card-${cardId}`} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-200">
          <ShieldAlert size={14} className="text-amber-300" aria-hidden="true" /> SLA
        </h2>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => { setCarregando(true); void carregar(); }} disabled={carregando} aria-label="Atualizar SLA">
          {carregando ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        </Button>
      </div>
      {erro ? <p role="alert" className="mt-2 text-xs text-rose-300">{erro}</p> : (
        <div className="mt-2 space-y-2">
          {itens.map((item) => (
            <div key={item.id} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-white">{item.nome}</p>
                <SlaStatusBadge sla={item} />
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">Prazo final: <span className="tabular-nums text-slate-300">{dataHora(item.deadline)}</span></p>
              {item.historicoPausas.length > 0 && (
                <details className="mt-2 text-[11px] text-slate-400">
                  <summary className="cursor-pointer">Histórico de pausas ({item.historicoPausas.length})</summary>
                  <ul className="mt-1 space-y-1 border-l border-white/10 pl-2">
                    {item.historicoPausas.map((evento) => (
                      <li key={evento.id}>{dataHora(evento.createdAt)} · {evento.statusAnterior ?? "INÍCIO"} → {evento.statusNovo}{evento.motivo ? ` · ${evento.motivo}` : ""}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
