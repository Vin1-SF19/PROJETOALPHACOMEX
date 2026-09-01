"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarPlus, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { AtualizarCardBpm, ObterCardBpm } from "@/actions/bpm/Cards";
import { useCardSave } from "./CardSaveContext";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;

interface PainelProximoContatoProps {
  card: CardDetalhe;
  onAtualizado: () => void;
  podeEditar: boolean;
  realtimeRevision: number;
}

function paraInputDatetimeLocal(data: Date | string | null): string {
  if (!data) return "";
  const valor = new Date(data);
  const pad = (numero: number) => String(numero).padStart(2, "0");
  return `${valor.getFullYear()}-${pad(valor.getMonth() + 1)}-${pad(valor.getDate())}T${pad(valor.getHours())}:${pad(valor.getMinutes())}`;
}

export function PainelProximoContato({ card, onAtualizado, podeEditar, realtimeRevision }: PainelProximoContatoProps) {
  const [valor, setValor] = useState(() => paraInputDatetimeLocal(card.proximoContatoEm));
  const [salvando, setSalvando] = useState(false);
  const [conflitoRealtime, setConflitoRealtime] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const sujoRef = useRef(false);
  const { registerSave } = useCardSave();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (sujoRef.current) {
        setConflitoRealtime(true);
        return;
      }
      setValor(paraInputDatetimeLocal(card.proximoContatoEm));
      setConflitoRealtime(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [card.proximoContatoEm, realtimeRevision]);

  async function persistir(proximoContatoEm: string | null) {
    if (!podeEditar || salvando) return;
    if (!proximoContatoEm) {
      setErro("Preencha a data do próximo contato.");
      return;
    }
    const valorPersistido = paraInputDatetimeLocal(card.proximoContatoEm);
    if (!sujoRef.current && (proximoContatoEm ?? "") === valorPersistido) return;
    setSalvando(true);
    const sucesso = await registerSave(async () => {
      const resultado = await AtualizarCardBpm({
        cardId: card.id,
        proximoContatoEm: proximoContatoEm ? new Date(proximoContatoEm).toISOString() : null,
      });
      if (!resultado.success) {
        toast.error(typeof resultado.error === "string" ? resultado.error : "Não foi possível atualizar o próximo contato");
        return false;
      }
      sujoRef.current = false;
      setConflitoRealtime(false);
      setErro(null);
      toast.success(proximoContatoEm ? "Próximo contato atualizado" : "Próximo contato removido");
      onAtualizado();
      return true;
    }).finally(() => {
      setSalvando(false);
    });
    if (sucesso) {
      if (!proximoContatoEm) setValor("");
    }
  }

  return (
    <section className="space-y-3 rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
        <CalendarPlus size={13} className="text-slate-500" aria-hidden="true" />
        Próximo Contato <span className="text-rose-400" aria-hidden="true">*</span>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`proximo-contato-${card.id}`} className="text-[11px] font-medium text-slate-400">
          Data e hora
        </label>
        <input
          id={`proximo-contato-${card.id}`}
          type="datetime-local"
          required
          aria-required="true"
          aria-invalid={Boolean(erro)}
          aria-describedby={erro ? `proximo-contato-erro-${card.id}` : undefined}
          value={valor}
          disabled={!podeEditar}
          onChange={(event) => {
            sujoRef.current = true;
            setValor(event.target.value);
            setErro(null);
          }}
          onBlur={() => void persistir(valor || null)}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-slate-200 outline-none transition-colors focus:border-white/25"
        />
      </div>
      {erro && <p id={`proximo-contato-erro-${card.id}`} role="alert" className="text-xs text-rose-300">{erro}</p>}
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
      {!podeEditar && <p className="text-[11px] text-slate-500">Somente o responsável ou um administrador pode alterar o próximo contato.</p>}
    </section>
  );
}
