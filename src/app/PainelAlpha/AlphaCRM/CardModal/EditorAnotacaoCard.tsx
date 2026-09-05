"use client";

import { useState } from "react";
import { ChevronDown, MessageSquareText } from "lucide-react";
import { toast } from "sonner";

import { CriarInteracaoCardBpm, type ListarInteracoesCardBpm } from "@/actions/bpm/Interacoes";
import { ObterCardBpm } from "@/actions/bpm/Cards";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
type Interacao = Awaited<ReturnType<typeof ListarInteracoesCardBpm>>["data"][number];

interface EditorAnotacaoCardProps {
  card: CardDetalhe;
  accent: string;
  podeEditar: boolean;
  onInteracaoCriada: (interacao: Interacao) => void;
}

const inputCls = "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-white/25";

export function EditorAnotacaoCard({
  card,
  accent,
  podeEditar,
  onInteracaoCriada,
}: EditorAnotacaoCardProps) {
  const [anotacao, setAnotacao] = useState("");
  const [salvandoAnotacao, setSalvandoAnotacao] = useState(false);

  async function salvarAnotacao() {
    if (!podeEditar || salvandoAnotacao || !anotacao.trim()) return;
    setSalvandoAnotacao(true);
    try {
      const res = await CriarInteracaoCardBpm({
        cardId: card.id,
        tipo: "ANOTACAO",
        observacoes: anotacao.trim(),
      });

      if (res.success && res.data) {
        toast.success("Anotação salva");
        onInteracaoCriada(res.data as unknown as Interacao);
        setAnotacao("");
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Erro ao salvar anotação");
      }
    } catch {
      toast.error("Erro ao salvar anotação");
    } finally {
      setSalvandoAnotacao(false);
    }
  }

  return (
    <details
      className="group max-h-[42.5vh] shrink-0 overflow-y-auto border-t-2 backdrop-blur-xl lg:max-h-[50%]"
      style={{
        borderColor: `rgba(${accent},0.55)`,
        background: `linear-gradient(180deg, rgba(${accent},0.12), rgba(2,6,23,0.92) 65%)`,
      }}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] shadow-lg"
          style={{
            background: `linear-gradient(110deg, rgba(${accent},0.4), rgba(${accent},0.15))`,
            borderColor: `rgba(${accent},0.55)`,
            borderWidth: 1,
            color: `rgb(${accent})`,
            boxShadow: `0 6px 18px -10px rgba(${accent},0.9)`,
          }}
        >
          <MessageSquareText size={13} aria-hidden="true" /> Anotação
        </span>
        <span className="flex shrink-0 items-center gap-2 text-[10px] text-slate-500">
          Aparece no Histórico
          <ChevronDown size={14} aria-hidden="true" className="shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
        </span>
      </summary>

      <div className="px-5 pb-4">
        <label htmlFor={`anotacao-card-${card.id}`} className="sr-only">
          Anotação
        </label>
        <textarea
          id={`anotacao-card-${card.id}`}
          className={`${inputCls} min-h-20 resize-none`}
          placeholder="Registre uma anotação sobre este contato..."
          value={anotacao}
          onChange={(event) => setAnotacao(event.target.value)}
          disabled={!podeEditar || salvandoAnotacao}
          style={{ borderColor: `rgba(${accent},0.3)` }}
        />
        <div className="mt-2 flex items-center justify-end gap-3">
          {salvandoAnotacao && (
            <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-500" role="status">
              <MessageSquareText size={13} aria-hidden="true" /> Salvando...
            </p>
          )}
          <button
            type="button"
            onClick={() => void salvarAnotacao()}
            disabled={!podeEditar || salvandoAnotacao || !anotacao.trim()}
            className="rounded-lg px-4 py-2 text-xs font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: `rgb(${accent})` }}
          >
            Salvar
          </button>
        </div>
      </div>
    </details>
  );
}
