"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Calculator, Loader2, RefreshCw } from "lucide-react";

import { CalcularRegraFinanceiraCard } from "@/actions/bpm/RegrasFinanceiras";
import { Button } from "@/components/ui/button";

type Calculo = NonNullable<Awaited<ReturnType<typeof CalcularRegraFinanceiraCard>> extends { data?: infer T } ? T : never>;

function moeda(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function PainelCalculoFinanceiro({ cardId, realtimeRevision }: { cardId: string; realtimeRevision: number }) {
  const [calculo, setCalculo] = useState<Calculo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const carregar = useCallback(() => {
    startTransition(async () => {
      setErro(null);
      const resultado = await CalcularRegraFinanceiraCard(cardId);
      if (!resultado.success) {
        setCalculo(null);
        setErro(resultado.error);
        return;
      }
      setCalculo(resultado.data);
    });
  }, [cardId]);

  useEffect(() => {
    carregar();
  }, [carregar, realtimeRevision]);

  return (
    <aside className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.04] p-4" aria-label="Cálculo financeiro configurado">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calculator className="size-4 text-emerald-300" aria-hidden="true" />
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-100">Cálculo por regra</p>
        </div>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 border-white/10" onClick={carregar} disabled={isPending}>
          {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Recalcular
        </Button>
      </div>
      {erro ? <p role="alert" className="mt-3 text-xs text-rose-300">{erro}</p> : isPending && !calculo ? (
        <p className="mt-3 text-xs text-slate-400">Consultando a regra publicada…</p>
      ) : !calculo ? (
        <p className="mt-3 text-xs text-slate-400">Nenhuma regra financeira aplicável ao card.</p>
      ) : (
        <div className="mt-3 space-y-2 text-xs">
          <p className="text-slate-300"><strong>{calculo.regraNome}</strong> · versão {calculo.regraVersao}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <span className="rounded-lg bg-black/20 p-2 text-slate-300">Bruto<br /><strong>{moeda(calculo.valorBrutoCents)}</strong></span>
            <span className="rounded-lg bg-black/20 p-2 text-slate-300">Retenções<br /><strong>{moeda(calculo.totalRetencoesCents)}</strong></span>
            <span className="rounded-lg bg-black/20 p-2 text-emerald-200">Líquido<br /><strong>{moeda(calculo.valorLiquidoCents)}</strong></span>
          </div>
          <details className="text-slate-400"><summary className="cursor-pointer">Memória de cálculo</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-black/20 p-2 text-[10px]">{JSON.stringify(JSON.parse(calculo.memoriaCalculo), null, 2)}</pre></details>
        </div>
      )}
    </aside>
  );
}
