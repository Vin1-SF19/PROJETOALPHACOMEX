"use client";

import { useEffect, useState } from "react";
import { Ban, CalendarClock, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  InterromperStandbyFollowUpBpm,
  ObterEstadoStandbyFollowUpBpm,
} from "@/actions/bpm/StandbyFollowUp";

type EstadoStandby = NonNullable<Awaited<ReturnType<typeof ObterEstadoStandbyFollowUpBpm>>["data"]>;

interface PainelStandbyFollowUpProps {
  cardId: string;
  accent: string;
  podeEditar: boolean;
  realtimeRevision: number;
  onAtualizado: () => void;
}

function formatarData(data: Date | string | null): string {
  if (!data) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(data));
}

export function PainelStandbyFollowUp({
  cardId,
  accent,
  podeEditar,
  realtimeRevision,
  onAtualizado,
}: PainelStandbyFollowUpProps) {
  const [estado, setEstado] = useState<EstadoStandby | null>(null);
  const [motivo, setMotivo] = useState("");
  const [confirmado, setConfirmado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let cancelado = false;
    ObterEstadoStandbyFollowUpBpm(cardId).then((resultado) => {
      if (cancelado) return;
      setCarregando(false);
      if (!resultado.success || !resultado.data) {
        setErro(typeof resultado.error === "string" ? resultado.error : "Não foi possível carregar o follow-up semanal.");
        return;
      }
      setEstado(resultado.data);
    }).catch(() => {
      if (cancelado) return;
      setCarregando(false);
      setErro("Não foi possível carregar o follow-up semanal.");
    });
    return () => { cancelado = true; };
  }, [cardId, realtimeRevision, tentativa]);

  async function interromper() {
    if (!podeEditar || !confirmado || motivo.trim().length < 2) return;
    setSalvando(true);
    const resultado = await InterromperStandbyFollowUpBpm({ cardId, motivo: motivo.trim() });
    setSalvando(false);
    if (!resultado.success) {
      toast.error(typeof resultado.error === "string" ? resultado.error : "Não foi possível interromper o follow-up semanal.");
      return;
    }
    setEstado((atual) => atual ? {
      ...atual,
      ativo: false,
      interrompidoEm: new Date(),
      proximoFollowUpEm: null,
    } : atual);
    setMotivo("");
    setConfirmado(false);
    toast.success("Follow-up semanal interrompido permanentemente.");
    onAtualizado();
  }

  if (carregando) {
    return <section className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 text-xs text-slate-400"><Loader2 size={14} className="animate-spin" /> Carregando follow-up semanal...</section>;
  }

  if (erro || !estado) {
    return (
      <section className="space-y-3 rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] p-4 text-xs text-rose-200">
        <p>{erro ?? "Não foi possível carregar o follow-up semanal."}</p>
        <button type="button" onClick={() => {
          setCarregando(true);
          setErro(null);
          setTentativa((valor) => valor + 1);
        }} className="rounded-xl border border-rose-300/30 px-3 py-2 font-semibold hover:bg-rose-200/10">Tentar novamente</button>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4" aria-labelledby={`standby-follow-up-${cardId}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: `rgba(${accent},0.15)` }}>
            <CalendarClock size={13} style={{ color: `rgb(${accent})` }} />
          </div>
          <div>
            <h3 id={`standby-follow-up-${cardId}`} className="text-xs font-bold uppercase tracking-wide text-white">Follow-up semanal</h3>
            <p className="mt-0.5 text-[11px] text-slate-500">Uma tarefa operacional a cada 7 dias. O sistema não envia mensagens externas automaticamente.</p>
          </div>
        </div>
        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${estado.ativo ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>
          {estado.ativo ? "Ativo" : "Interrompido"}
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-2 border-t border-white/5 pt-3 text-xs sm:grid-cols-2">
        <div><dt className="text-slate-500">Último follow-up</dt><dd className="mt-0.5 font-medium text-slate-200">{formatarData(estado.ultimoFollowUpEm)}</dd></div>
        <div><dt className="text-slate-500">Próxima tarefa</dt><dd className="mt-0.5 font-medium text-slate-200">{estado.ativo ? formatarData(estado.proximoFollowUpEm) : "Não será criada"}</dd></div>
      </dl>

      {!estado.ativo ? (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-3 text-xs text-rose-200"><ShieldCheck size={14} className="mt-0.5 shrink-0" /> O pedido de interrupção foi registrado em {formatarData(estado.interrompidoEm)}. A automação NoLoss não será retomada automaticamente.</div>
      ) : (
        <div className="space-y-3 border-t border-white/5 pt-3">
          <div className="flex items-start gap-2 text-xs text-amber-200"><Ban size={14} className="mt-0.5 shrink-0" /> Use apenas quando a pessoa solicitar que não receba mais contatos. Esta ação encerra a automação permanentemente.</div>
          <div className="space-y-1.5">
            <label htmlFor={`motivo-standby-${cardId}`} className="text-[11px] font-medium text-slate-400">Motivo do pedido *</label>
            <textarea id={`motivo-standby-${cardId}`} value={motivo} disabled={!podeEditar || salvando} onChange={(evento) => setMotivo(evento.target.value)} className="min-h-20 w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-white/25 disabled:opacity-60" placeholder="Ex.: Lead solicitou não receber mais contatos." />
          </div>
          <label className="flex cursor-pointer items-start gap-2 text-[11px] text-slate-400">
            <input type="checkbox" checked={confirmado} disabled={!podeEditar || salvando} onChange={(evento) => setConfirmado(evento.target.checked)} className="mt-0.5" />
            Confirmo que a pessoa pediu a interrupção permanente do follow-up.
          </label>
          {podeEditar && <button type="button" onClick={() => void interromper()} disabled={!confirmado || motivo.trim().length < 2 || salvando} className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2.5 text-xs font-semibold text-rose-200 transition-colors hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-45">{salvando && <Loader2 size={13} className="animate-spin" />} Interromper follow-up permanentemente</button>}
          {!podeEditar && <p className="text-[11px] text-slate-500">Somente o responsável ou um administrador pode interromper o follow-up.</p>}
        </div>
      )}
    </section>
  );
}
