"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarPlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AtualizarCardBpm, ObterCardBpm } from "@/actions/bpm/Cards";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;

interface PainelProximoContatoProps {
  card: CardDetalhe;
  accent: string;
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

export function PainelProximoContato({ card, accent, onAtualizado, podeEditar, realtimeRevision }: PainelProximoContatoProps) {
  const [valor, setValor] = useState(() => paraInputDatetimeLocal(card.proximoContatoEm));
  const [salvando, setSalvando] = useState(false);
  const [conflitoRealtime, setConflitoRealtime] = useState(false);
  const sujoRef = useRef(false);

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
    setSalvando(true);
    const resultado = await AtualizarCardBpm({
      cardId: card.id,
      proximoContatoEm: proximoContatoEm ? new Date(proximoContatoEm).toISOString() : null,
    });
    setSalvando(false);

    if (!resultado.success) {
      toast.error(typeof resultado.error === "string" ? resultado.error : "Não foi possível atualizar o próximo contato");
      return;
    }

    if (!proximoContatoEm) setValor("");
    sujoRef.current = false;
    setConflitoRealtime(false);
    toast.success(proximoContatoEm ? "Próximo contato atualizado" : "Próximo contato removido");
    onAtualizado();
  }

  return (
    <section className="space-y-3 rounded-3xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
        <CalendarPlus size={13} className="text-slate-500" />
        Próximo contato
      </div>

      <div className="space-y-1.5">
        <label htmlFor={`proximo-contato-${card.id}`} className="text-[11px] font-medium text-slate-400">
          Data e hora
        </label>
        <input
          id={`proximo-contato-${card.id}`}
          type="datetime-local"
          value={valor}
          disabled={!podeEditar}
          onChange={(event) => {
            sujoRef.current = true;
            setValor(event.target.value);
          }}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-slate-200 outline-none transition-colors focus:border-white/25"
        />
      </div>
      {conflitoRealtime && <p className="rounded-xl border border-sky-500/25 bg-sky-500/[0.07] p-3 text-xs text-sky-200">O próximo contato mudou externamente. Seu rascunho foi preservado.</p>}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void persistir(null)}
          disabled={!podeEditar || salvando || (!valor && !card.proximoContatoEm)}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold text-slate-400 transition-colors hover:border-rose-500/30 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 size={12} /> Limpar
        </button>
        <button
          type="button"
          onClick={() => void persistir(valor)}
          disabled={!podeEditar || salvando || !valor}
          className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: `rgba(${accent},0.85)` }}
        >
          {salvando ? <Loader2 size={12} className="animate-spin" /> : <CalendarPlus size={12} />}
          Salvar
        </button>
      </div>
      {!podeEditar && <p className="text-[11px] text-slate-500">Somente o responsável ou um administrador pode alterar o próximo contato.</p>}
    </section>
  );
}
