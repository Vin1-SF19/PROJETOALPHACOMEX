"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarPlus, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { AtualizarCardBpm, ObterCardBpm } from "@/actions/bpm/Cards";
import { criarRastreadorRascunho } from "@/lib/bpm/rascunho-versionado";
import { formatarDataHoraLocalBpm, parseDataHoraLocalBpm } from "@/lib/format-date";
import { BpmDateTimeField } from "./BpmDateTimeField";
import { useCardSave } from "./CardSaveContext";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;

interface PainelProximoContatoProps {
  card: CardDetalhe;
  onAtualizado: () => void;
  podeEditar: boolean;
  realtimeRevision: number;
}

export function PainelProximoContato({ card, onAtualizado, podeEditar, realtimeRevision }: PainelProximoContatoProps) {
  const [valor, setValor] = useState(() => formatarDataHoraLocalBpm(card.proximoContatoEm));
  const [salvando, setSalvando] = useState(false);
  const [conflitoRealtime, setConflitoRealtime] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const sujoRef = useRef(false);
  const valorPersistidoRef = useRef(formatarDataHoraLocalBpm(card.proximoContatoEm));
  const rascunhoRef = useRef(criarRastreadorRascunho(formatarDataHoraLocalBpm(card.proximoContatoEm)));
  const savesPendentesRef = useRef(0);
  const { registerSave } = useCardSave();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (sujoRef.current) {
        const valorRecebido = formatarDataHoraLocalBpm(card.proximoContatoEm);
        if (valorRecebido !== valorPersistidoRef.current) setConflitoRealtime(true);
        return;
      }
      const valorRecebido = formatarDataHoraLocalBpm(card.proximoContatoEm);
      valorPersistidoRef.current = valorRecebido;
      rascunhoRef.current.sincronizar(valorRecebido);
      setValor(valorRecebido);
      setConflitoRealtime(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [card.proximoContatoEm, realtimeRevision]);

  async function persistir(proximoContatoEm: string | null) {
    if (!podeEditar) return;
    const dataPersistida = proximoContatoEm
      ? parseDataHoraLocalBpm(proximoContatoEm)
      : null;
    if (proximoContatoEm && !dataPersistida) {
      setErro("Escolha uma data e uma hora válidas.");
      return;
    }
    const valorPersistido = formatarDataHoraLocalBpm(card.proximoContatoEm);
    if (!sujoRef.current && (proximoContatoEm ?? "") === valorPersistido) return;
    const snapshot = rascunhoRef.current.capturar();
    savesPendentesRef.current += 1;
    setSalvando(true);
    const sucesso = await registerSave(async () => {
      const resultado = await AtualizarCardBpm({
        cardId: card.id,
        proximoContatoEm: dataPersistida?.toISOString() ?? null,
      });
      if (!resultado.success) {
        toast.error(typeof resultado.error === "string" ? resultado.error : "Não foi possível atualizar o próximo contato");
        return false;
      }
      valorPersistidoRef.current = snapshot.valor;
      if (rascunhoRef.current.corresponde(snapshot)) {
        sujoRef.current = false;
        setConflitoRealtime(false);
        setErro(null);
      }
      toast.success(proximoContatoEm ? "Próximo contato atualizado" : "Próximo contato removido");
      onAtualizado();
      return true;
    }).finally(() => {
      savesPendentesRef.current -= 1;
      if (savesPendentesRef.current === 0) setSalvando(false);
    });
    if (sucesso) {
      if (!proximoContatoEm && rascunhoRef.current.corresponde(snapshot)) setValor("");
    }
  }

  return (
    <section className="space-y-3 rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
        <CalendarPlus size={13} className="text-slate-500" aria-hidden="true" />
        Próximo Contato
      </div>

      <div className="space-y-1.5">
        <BpmDateTimeField
          id={`proximo-contato-${card.id}`}
          label="Data e hora"
          allowClear
          value={valor}
          disabled={!podeEditar}
          error={erro}
          onChange={(novoValor) => {
            sujoRef.current = true;
            rascunhoRef.current.alterar(novoValor);
            setValor(novoValor);
            setErro(null);
          }}
          onCommit={(novoValor) => void persistir(novoValor || null)}
        />
      </div>
      {conflitoRealtime && <p className="rounded-xl border border-sky-500/25 bg-sky-500/[0.07] p-3 text-xs text-sky-200">O próximo contato mudou externamente. Seu rascunho foi preservado.</p>}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void persistir(valor || null)}
          disabled={!podeEditar || salvando}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save size={12} aria-hidden="true" /> Salvar próximo contato
        </button>
        {salvando && <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500"><Loader2 size={12} className="animate-spin" /> Salvando...</span>}
      </div>
      {!podeEditar && <p className="text-[11px] text-slate-500">Você não tem permissão para alterar o próximo contato neste card.</p>}
    </section>
  );
}
