"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarClock, Loader2, Pause, Play, Plus, X } from "lucide-react";
import { toast } from "sonner";

import {
  CancelarCadenciaCardBpm,
  IniciarCadenciaCardBpm,
  ListarCadenciasBpm,
  ListarCadenciasDoCardBpm,
  PausarCadenciaCardBpm,
  ReativarCadenciaCardBpm,
} from "@/actions/bpm/Cadencias";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDateTime } from "@/lib/format-date";

type Vinculo = {
  id: string;
  status: string;
  passoAtualOrdem: number;
  proximaExecucaoEm: string | null;
  motivoInterrupcao: string | null;
  cadencia: { id: string; nome: string; passos: { ordem: number }[] };
};

const STATUS_LABEL: Record<string, { label: string; cor: string }> = {
  ATIVA: { label: "Ativa", cor: "text-emerald-300 border-emerald-400/25 bg-emerald-400/[0.08]" },
  PAUSADA: { label: "Pausada", cor: "text-amber-300 border-amber-400/25 bg-amber-400/[0.08]" },
  CONCLUIDA: { label: "Concluída", cor: "text-slate-400 border-slate-400/25 bg-slate-400/[0.08]" },
  CANCELADA: { label: "Cancelada", cor: "text-rose-300 border-rose-400/25 bg-rose-400/[0.08]" },
};

export function PainelCadenciasCard({ cardId, accent }: { cardId: string; accent: string }) {
  const [vinculos, setVinculos] = useState<Vinculo[] | null>(null);
  const [disponiveis, setDisponiveis] = useState<{ id: string; nome: string }[]>([]);
  const [cadenciaSelecionada, setCadenciaSelecionada] = useState("");
  const [pendente, startTransition] = useTransition();

  function recarregar() {
    ListarCadenciasDoCardBpm(cardId).then((res) => {
      if (res.success) setVinculos(res.data as Vinculo[]);
    });
  }

  useEffect(() => {
    recarregar();
    ListarCadenciasBpm().then((res) => {
      if (res.success) setDisponiveis(res.data.filter((c) => c.ativa).map((c) => ({ id: c.id, nome: c.nome })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  function iniciar() {
    if (!cadenciaSelecionada) return;
    startTransition(async () => {
      const resposta = await IniciarCadenciaCardBpm({ cardId, cadenciaId: cadenciaSelecionada });
      if (!resposta.success) { toast.error(typeof resposta.error === "string" ? resposta.error : "Erro ao iniciar cadência."); return; }
      toast.success("Cadência iniciada");
      setCadenciaSelecionada("");
      recarregar();
    });
  }

  function pausar(vinculoId: string) {
    startTransition(async () => {
      const resposta = await PausarCadenciaCardBpm({ vinculoId });
      if (!resposta.success) toast.error("Erro ao pausar."); else recarregar();
    });
  }
  function cancelar(vinculoId: string) {
    startTransition(async () => {
      const resposta = await CancelarCadenciaCardBpm({ vinculoId });
      if (!resposta.success) toast.error("Erro ao cancelar."); else recarregar();
    });
  }
  function reativar(vinculoId: string) {
    startTransition(async () => {
      const resposta = await ReativarCadenciaCardBpm({ vinculoId });
      if (!resposta.success) toast.error("Erro ao reativar."); else recarregar();
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
      {vinculos.map((v) => {
        const meta = STATUS_LABEL[v.status] ?? STATUS_LABEL.ATIVA;
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
            {v.motivoInterrupcao && <p className="mt-1 text-[10px] opacity-75">Motivo: {v.motivoInterrupcao}</p>}
            <div className="mt-1.5 flex gap-1.5">
              {v.status === "ATIVA" && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => pausar(v.id)} disabled={pendente}>
                  <Pause size={11} className="mr-1" /> Pausar
                </Button>
              )}
              {v.status === "PAUSADA" && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => reativar(v.id)} disabled={pendente}>
                  <Play size={11} className="mr-1" /> Reativar
                </Button>
              )}
              {(v.status === "ATIVA" || v.status === "PAUSADA") && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-rose-400" onClick={() => cancelar(v.id)} disabled={pendente}>
                  <X size={11} className="mr-1" /> Cancelar
                </Button>
              )}
            </div>
          </div>
        );
      })}
      {vinculos.length === 0 && <p className="text-xs text-slate-600">Nenhuma cadência vinculada a este card.</p>}

      {disponiveis.length > 0 && (
        <div className="flex gap-1.5 pt-1">
          <Select value={cadenciaSelecionada} onValueChange={setCadenciaSelecionada}>
            <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue placeholder="Iniciar cadência…" /></SelectTrigger>
            <SelectContent>
              {disponiveis.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8" onClick={iniciar} disabled={pendente || !cadenciaSelecionada} style={{ background: `rgba(${accent},0.85)` }}>
            <Plus size={13} />
          </Button>
        </div>
      )}
    </div>
  );
}
