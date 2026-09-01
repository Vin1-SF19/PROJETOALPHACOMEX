"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Milestone } from "lucide-react";
import { toast } from "sonner";
import { AtualizarCardBpm } from "@/actions/bpm/Cards";
import { useCardSave } from "./CardSaveContext";
import {
  STATUS_POS_FECHAMENTO_OPCOES,
  obterStatusPosFechamentoConfig,
  statusPosFechamentoEhValido,
  type StatusPosFechamento,
} from "@/lib/bpm/status-pos-fechamento";
import { cn } from "@/lib/utils";

interface PainelStatusPosFechamentoProps {
  cardId: string;
  statusPersistido: string | null;
  versaoPersistidaEm: Date | string;
  podeEditar: boolean;
  realtimeRevision: number;
  accent: string;
  onAtualizado: () => void;
}

export function PainelStatusPosFechamento({
  cardId,
  statusPersistido,
  versaoPersistidaEm,
  podeEditar,
  realtimeRevision,
  accent,
  onAtualizado,
}: PainelStatusPosFechamentoProps) {
  const statusReconhecido = statusPosFechamentoEhValido(statusPersistido)
    ? statusPersistido
    : null;
  const [rascunho, setRascunho] = useState<StatusPosFechamento | null>(statusReconhecido);
  const [base, setBase] = useState<StatusPosFechamento | null>(statusReconhecido);
  const versaoRemota = new Date(versaoPersistidaEm).toISOString();
  const [versaoBase, setVersaoBase] = useState(versaoRemota);
  const [snapshotRemotoPendente, setSnapshotRemotoPendente] = useState<{
    status: StatusPosFechamento | null;
    versao: string;
  } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [conflitoRealtime, setConflitoRealtime] = useState(false);
  const rascunhoSujoRef = useRef(false);
  const confirmacaoLocalPendenteRef = useRef<{
    status: StatusPosFechamento;
    versaoAnterior: string;
  } | null>(null);
  const { registerSave } = useCardSave();

  useEffect(() => {
    const timer = setTimeout(() => {
      const confirmacaoLocal = confirmacaoLocalPendenteRef.current;
      if (confirmacaoLocal) {
        const propsAindaSaoSnapshotAnterior =
          versaoRemota === confirmacaoLocal.versaoAnterior
          && statusReconhecido !== confirmacaoLocal.status;
        if (propsAindaSaoSnapshotAnterior) return;

        confirmacaoLocalPendenteRef.current = null;
        if (statusReconhecido === confirmacaoLocal.status) {
          setBase(statusReconhecido);
          setVersaoBase(versaoRemota);
          setSnapshotRemotoPendente(null);
          setConflitoRealtime(false);
          if (!rascunhoSujoRef.current) setRascunho(statusReconhecido);
          return;
        }
      }

      if (rascunhoSujoRef.current) {
        const snapshotRemotoMudou = statusReconhecido !== base || versaoRemota !== versaoBase;
        if (!snapshotRemotoMudou) {
          setConflitoRealtime(false);
          setSnapshotRemotoPendente(null);
          return;
        }
        setConflitoRealtime(true);
        setSnapshotRemotoPendente({ status: statusReconhecido, versao: versaoRemota });
        return;
      }
      setRascunho(statusReconhecido);
      setBase(statusReconhecido);
      setVersaoBase(versaoRemota);
      setSnapshotRemotoPendente(null);
      setConflitoRealtime(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [base, statusReconhecido, versaoBase, versaoRemota, realtimeRevision]);

  const configAtual = obterStatusPosFechamentoConfig(rascunho);

  async function salvar(status: StatusPosFechamento) {
    if (!podeEditar || status === base) return;
    const versaoBaseAtual = versaoBase;
    setSalvando(true);
    const sucesso = await registerSave(async () => {
      const resultado = await AtualizarCardBpm({
        cardId,
        statusPosFechamento: status,
        versaoEsperadaEm: versaoBaseAtual,
      });
      if (!resultado.success) {
        const mensagem = typeof resultado.error === "string"
          ? resultado.error
          : "Não foi possível salvar o status pós-fechamento.";
        const houveConflito = mensagem.toLocaleLowerCase("pt-BR").includes("mudou enquanto");
        setConflitoRealtime(houveConflito);
        toast.error(mensagem);
        if (houveConflito) onAtualizado();
        return false;
      }
      confirmacaoLocalPendenteRef.current = {
        status,
        versaoAnterior: versaoBaseAtual,
      };
      rascunhoSujoRef.current = false;
      setBase(status);
      setConflitoRealtime(false);
      toast.success("Status pós-fechamento atualizado");
      onAtualizado();
      return true;
    }).finally(() => {
      setSalvando(false);
    });
    return sucesso;
  }

  function usarStatusAtualizado() {
    if (!snapshotRemotoPendente) return;
    rascunhoSujoRef.current = false;
    setRascunho(snapshotRemotoPendente.status);
    setBase(snapshotRemotoPendente.status);
    setVersaoBase(snapshotRemotoPendente.versao);
    setSnapshotRemotoPendente(null);
    setConflitoRealtime(false);
  }

  return (
    <section
      className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
      aria-labelledby={`status-pos-fechamento-titulo-${cardId}`}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `rgba(${accent},0.15)` }}
        >
          <Milestone size={13} style={{ color: `rgb(${accent})` }} />
        </div>
        <div>
          <h3 id={`status-pos-fechamento-titulo-${cardId}`} className="text-xs font-bold uppercase tracking-wide text-white">
            Status pós-fechamento
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">Acompanhamento operacional após a venda.</p>
        </div>
      </div>

      {conflitoRealtime && snapshotRemotoPendente && (
        <div role="alert" className="space-y-2 rounded-xl border border-sky-500/25 bg-sky-500/[0.07] p-3 text-xs text-sky-200">
          O status persistido mudou enquanto você editava. Seu rascunho foi preservado; revise-o antes de salvar novamente.
          <button
            type="button"
            onClick={usarStatusAtualizado}
            className="mt-2 block font-semibold text-sky-100 underline decoration-sky-300/60 underline-offset-2 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60"
          >
            Usar status atualizado
          </button>
        </div>
      )}

      <div className="space-y-1.5 border-t border-white/5 pt-3">
        <label htmlFor={`status-pos-fechamento-${cardId}`} className="text-[11px] font-medium text-slate-400">Status</label>
        <select
          id={`status-pos-fechamento-${cardId}`}
          value={rascunho ?? ""}
          onChange={(event) => {
            if (!statusPosFechamentoEhValido(event.target.value)) return;
            rascunhoSujoRef.current = event.target.value !== base;
            setRascunho(event.target.value);
            void salvar(event.target.value);
          }}
          disabled={!podeEditar || salvando}
          aria-describedby={`status-pos-fechamento-ajuda-${cardId}`}
          className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-65"
        >
          <option value="" disabled>Status ainda não definido</option>
          {STATUS_POS_FECHAMENTO_OPCOES.map((opcao) => (
            <option key={opcao.codigo} value={opcao.codigo}>{opcao.label}</option>
          ))}
        </select>

        <div id={`status-pos-fechamento-ajuda-${cardId}`} className="flex min-h-6 items-center justify-between gap-2">
          {configAtual ? (
            <span className={cn("rounded-md border px-2 py-1 text-[10px] font-semibold", configAtual.badgeClassName)}>{configAtual.label}</span>
          ) : (
            <span className="text-[11px] text-slate-500">Status ainda não definido.</span>
          )}
          {!podeEditar && <span className="text-[11px] text-slate-500">Somente leitura</span>}
        </div>
      </div>

      {salvando && <p className="flex items-center gap-2 text-[11px] text-slate-500"><Loader2 size={13} className="animate-spin" /> Salvando status...</p>}
    </section>
  );
}
