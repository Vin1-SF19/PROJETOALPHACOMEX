"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarClock, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import {
  CancelarCadenciaCardBpm,
  ListarCadenciasDoCardBpm,
} from "@/actions/bpm/Cadencias";
import { Button } from "@/components/ui/button";
import { fmtDateTime } from "@/lib/format-date";

type Vinculo = {
  id: string;
  status: string;
  passoAtualOrdem: number;
  proximaExecucaoEm: string | null;
  motivoInterrupcao: string | null;
  cadencia: {
    id: string;
    nome: string;
    pipeline: { id: string; nome: string } | null;
    etapa: { id: string; nome: string } | null;
    passos: { ordem: number; titulo: string }[];
  };
};

const STATUS_LABEL: Record<string, { label: string; cor: string }> = {
  ATIVA: { label: "Ativa", cor: "text-emerald-300 border-emerald-400/25 bg-emerald-400/[0.08]" },
  PAUSADA: { label: "Pausada", cor: "text-amber-300 border-amber-400/25 bg-amber-400/[0.08]" },
  CONCLUIDA: { label: "Concluída", cor: "text-slate-400 border-slate-400/25 bg-slate-400/[0.08]" },
  CANCELADA: { label: "Cancelada", cor: "text-rose-300 border-rose-400/25 bg-rose-400/[0.08]" },
};

export function PainelCadenciasCard({ cardId, accent }: { cardId: string; accent: string }) {
  const [vinculos, setVinculos] = useState<Vinculo[] | null>(null);
  const [pendente, startTransition] = useTransition();

  function recarregar() {
    ListarCadenciasDoCardBpm(cardId).then((res) => {
      if (res.success) setVinculos(res.data as Vinculo[]);
    });
  }

  useEffect(() => {
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);
  function cancelar(vinculoId: string) {
    startTransition(async () => {
      const resposta = await CancelarCadenciaCardBpm({ vinculoId });
      if (!resposta.success) toast.error("Erro ao cancelar."); else recarregar();
    });
  }

  if (vinculos === null) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={18} className="animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-slate-400" style={{ borderLeftColor: `rgba(${accent},0.65)` }}>
        As cadências são ativadas automaticamente quando o card entra no escopo configurado, nunca impedem o avanço e não podem ser pausadas manualmente.
      </div>
      {vinculos.map((v) => {
        const meta = STATUS_LABEL[v.status] ?? STATUS_LABEL.ATIVA;
        const proximoPasso = v.cadencia.passos.find((passo) => passo.ordem === v.passoAtualOrdem);
        const escopo = v.cadencia.pipeline && v.cadencia.etapa
          ? `${v.cadencia.pipeline.nome} / ${v.cadencia.etapa.nome}`
          : "Legado sem coluna — inoperante";
        return (
          <div key={v.id} className={`rounded-xl border px-3 py-2 text-xs ${meta.cor}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-medium">
                <CalendarClock size={13} /> {v.cadencia.nome}
              </div>
              <span className="text-[10px] opacity-75">{meta.label} · passo {v.passoAtualOrdem}/{v.cadencia.passos.length}</span>
            </div>
            {v.proximaExecucaoEm && v.status === "ATIVA" && (
              <p className="mt-1 text-[10px] opacity-75">Próxima execução: {fmtDateTime(v.proximaExecucaoEm)}</p>
            )}
            <p className="mt-1 text-[10px] opacity-75">Escopo: {escopo}</p>
            {proximoPasso && <p className="mt-1 text-[10px] opacity-75">Próximo passo: {proximoPasso.titulo}</p>}
            {v.motivoInterrupcao && <p className="mt-1 text-[10px] opacity-75">Motivo: {v.motivoInterrupcao}</p>}
            <div className="mt-1.5 flex gap-1.5">
              {(v.status === "ATIVA" || v.status === "PAUSADA") && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-rose-400" onClick={() => cancelar(v.id)} disabled={pendente}>
                  <X size={11} className="mr-1" /> Cancelar
                </Button>
              )}
            </div>
          </div>
        );
      })}
      {vinculos.length === 0 && <p className="text-xs text-slate-600">Nenhuma cadência configurada para esta coluna. O card pode avançar normalmente.</p>}
    </div>
  );
}
