"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, MessageSquareText } from "lucide-react";
import { toast } from "sonner";

import { CriarInteracaoCardBpm, type ListarInteracoesCardBpm } from "@/actions/bpm/Interacoes";
import { ObterCardBpm } from "@/actions/bpm/Cards";
import { useCardSave } from "./CardSaveContext";

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
  const { getDraft, setDraft, setPendingFields, registerSave, registerManualSave } = useCardSave();
  const draftKey = `${card.id}:anotacao`;
  const [anotacao, setAnotacao] = useState(() => getDraft(draftKey)?.texto ?? "");
  const textoRef = useRef(anotacao);
  const requestId = useRef(getDraft(draftKey)?.requestId ?? crypto.randomUUID());
  const enviandoRef = useRef<Promise<boolean> | null>(null);
  const [salvandoAnotacao, setSalvandoAnotacao] = useState(false);

  function alterarAnotacao(texto: string) {
    if (textoRef.current !== texto) {
      requestId.current = crypto.randomUUID();
    }
    textoRef.current = texto;
    setAnotacao(texto);
    setDraft(draftKey, texto.trim() ? { texto, requestId: requestId.current } : undefined);
    setPendingFields(draftKey, texto.trim() ? [{ label: "Anotação", after: texto }] : []);
  }
  function salvarAnotacao(): Promise<boolean> {
    if (enviandoRef.current) return enviandoRef.current;
    if (!textoRef.current.trim()) return Promise.resolve(true);
    if (!podeEditar) return Promise.resolve(false);
    const texto = textoRef.current;
    const intencao = requestId.current;
    setSalvandoAnotacao(true);
    const promise = registerSave(async () => {
      try {
        const res = await CriarInteracaoCardBpm({ cardId: card.id, tipo: "ANOTACAO", observacoes: texto.trim(), idempotencyKey: intencao });
        if (!res.success || !res.data) {
          toast.error(typeof res.error === "string" ? res.error : "Erro ao salvar anotação");
          return false;
        }
        const rascunhoAtual = getDraft(draftKey);
        if (textoRef.current === texto && rascunhoAtual?.texto === texto && rascunhoAtual.requestId === intencao) {
          textoRef.current = "";
          requestId.current = crypto.randomUUID();
          setAnotacao("");
          setDraft(draftKey);
          setPendingFields(draftKey, []);
        }
        onInteracaoCriada(res.data as unknown as Interacao);
        toast.success("Anotação salva");
        return true;
      } catch {
        toast.error("Não foi possível salvar a anotação. Seu rascunho foi preservado.");
        return false;
      }
    }, card.id, draftKey).finally(() => {
      enviandoRef.current = null;
      setSalvandoAnotacao(false);
    });
    enviandoRef.current = promise;
    return promise;
  }
  const salvarRef = useRef(salvarAnotacao);
  useEffect(() => { salvarRef.current = salvarAnotacao; });
  useEffect(() => registerManualSave(card.id, draftKey, () => salvarRef.current()), [card.id, draftKey, registerManualSave]);
  useEffect(() => {
    setPendingFields(draftKey, textoRef.current.trim() ? [{ label: "Anotação", after: textoRef.current }] : []);
  }, [draftKey, setPendingFields]);

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
          onChange={(event) => alterarAnotacao(event.target.value)}
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
