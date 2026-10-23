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

const inputCls = "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm leading-relaxed text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus-visible:border-slate-400 focus-visible:ring-1 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50";

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
      className="group max-h-[42.5vh] shrink-0 overflow-y-auto border-t border-white/10 bg-slate-950/40 lg:max-h-[50%]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2.5">
          <MessageSquareText size={16} aria-hidden="true" className="shrink-0 text-slate-400" />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-200">Anotação</span>
            <span className="mt-0.5 block text-[11px] text-slate-400">Aparece no Histórico</span>
          </span>
        </span>
        <ChevronDown size={14} aria-hidden="true" className="shrink-0 text-slate-400 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>

      <div className="px-5 pb-4">
        <label htmlFor={`anotacao-card-${card.id}`} className="sr-only">
          Anotação
        </label>
        <textarea
          id={`anotacao-card-${card.id}`}
          className={`${inputCls} min-h-24 resize-none`}
          placeholder="Registre uma anotação sobre este contato..."
          value={anotacao}
          onChange={(event) => setAnotacao(event.target.value)}
          disabled={!podeEditar || salvandoAnotacao}
        />
        <div className="mt-3 flex items-center justify-end gap-3">
          {salvandoAnotacao && (
            <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-400" role="status">
              <MessageSquareText size={13} aria-hidden="true" /> Salvando...
            </p>
          )}
          <button
            type="button"
            onClick={() => void salvarAnotacao()}
            disabled={!podeEditar || salvandoAnotacao || !anotacao.trim()}
            className="crm-tema-fixo rounded-lg px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: `rgb(${accent})` }}
          >
            Salvar
          </button>
        </div>
      </div>
    </details>
  );
}
