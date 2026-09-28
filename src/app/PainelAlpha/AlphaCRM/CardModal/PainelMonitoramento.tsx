"use client";

import { useEffect, useState } from "react";
import { ObterProximaVerificacaoMonitoramentoBpm } from "@/actions/bpm/Monitoramento";

export function PainelMonitoramento({ cardId, realtimeRevision }: { cardId: string; realtimeRevision: number }) {
  const [estado, setEstado] = useState<{ proximaVerificacaoEm: string | null; ativa: boolean } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vigente = true;
    void ObterProximaVerificacaoMonitoramentoBpm(cardId).then((resposta) => {
      if (!vigente) return;
      if (resposta.success) { setEstado(resposta.data); setErro(null); }
      else { setEstado(null); setErro(resposta.error); }
    });
    return () => { vigente = false; };
  }, [cardId, realtimeRevision]);
  const proxima = estado?.proximaVerificacaoEm
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(estado.proximaVerificacaoEm))
    : null;
  return <section aria-label="Monitoramento" className="rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] p-3 text-sm text-slate-200">
    <p className="font-semibold text-white">Próxima verificação</p>
    {erro ? <p role="alert" className="mt-1 text-rose-300">{erro}</p>
      : !estado ? <p className="mt-1 text-slate-400">Consultando agenda…</p>
      : !estado.ativa ? <p className="mt-1 text-slate-400">Revisão automática pausada.</p>
      : <p className="mt-1">{proxima ?? "Aguardando agendamento da revisão."}</p>}
    <p className="mt-1 text-xs text-slate-500">Data calculada pelo ciclo de revisão desta etapa.</p>
  </section>;
}
