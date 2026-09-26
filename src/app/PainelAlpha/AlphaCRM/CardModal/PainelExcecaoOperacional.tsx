"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AutorizarExcecaoLiberacaoOperacionalBpm } from "@/actions/bpm/ExcecaoOperacional";

export function PainelExcecaoOperacional({ cardId, onAtualizado }: { cardId: string; onAtualizado: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function autorizar() {
    if (motivo.trim().length < 20 || enviando) return;
    setEnviando(true);
    try {
      const resultado = await AutorizarExcecaoLiberacaoOperacionalBpm({ cardId, motivo });
      if (!resultado.success) { toast.error(resultado.error); return; }
      toast.success("Liberação excepcional registrada e enviada ao Operacional.");
      setMotivo("");
      onAtualizado();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4" aria-label="Exceção de liberação operacional">
      <h3 className="text-sm font-semibold text-amber-200">Liberação excepcional ao Operacional</h3>
      <p className="mt-1 text-xs text-slate-300">Admin, CEO e TI podem dispensar dados de execução pendentes após uma tentativa de liberação bloqueada. Contrato assinado e pagamento confirmado continuam obrigatórios.</p>
      <label htmlFor={`motivo-excecao-${cardId}`} className="mt-3 block text-xs text-slate-300">Motivo da exceção</label>
      <textarea id={`motivo-excecao-${cardId}`} value={motivo} onChange={(event) => setMotivo(event.target.value)}
        maxLength={1000} rows={3} className="mt-1 w-full rounded-lg border border-white/15 bg-black/20 p-2 text-sm text-white"
        placeholder="Descreva por que o Operacional pode iniciar sem os dados pendentes." />
      <button type="button" disabled={enviando || motivo.trim().length < 20} onClick={() => { void autorizar(); }}
        className="mt-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
        {enviando ? "Autorizando…" : "Autorizar e tentar liberar"}
      </button>
    </section>
  );
}
