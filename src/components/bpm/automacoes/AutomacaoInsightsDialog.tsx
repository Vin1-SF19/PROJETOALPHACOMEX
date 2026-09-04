"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  ListarHistoricoAutomacaoBpm,
  SimularAutomacaoBpm,
} from "@/actions/bpm/Automacoes";
import type {
  AutomacaoBpmView,
  HistoricoAutomacaoItem,
} from "@/components/bpm/automacoes/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

function formatarData(valor: string | null) {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(valor));
}

export function AutomacaoInsightsDialog(props: {
  automacao: AutomacaoBpmView;
  onClose: () => void;
}) {
  const [historico, setHistorico] = useState<HistoricoAutomacaoItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [cardId, setCardId] = useState("");
  const [simulacao, setSimulacao] = useState<unknown>(null);
  const [simulando, iniciarSimulacao] = useTransition();

  useEffect(() => {
    let ativo = true;
    void ListarHistoricoAutomacaoBpm(props.automacao.id).then((resultado) => {
      if (!ativo) return;
      if (resultado.success) setHistorico(resultado.data);
      else toast.error(resultado.error);
      setCarregando(false);
    });
    return () => { ativo = false; };
  }, [props.automacao.id]);

  function simular() {
    iniciarSimulacao(async () => {
      const resultado = await SimularAutomacaoBpm({ automacaoId: props.automacao.id, cardId });
      if (!resultado.success) {
        toast.error(resultado.error);
        return;
      }
      setSimulacao(resultado.data);
    });
  }

  const permiteSimular = ["DISTRIBUIR_RESPONSAVEL", "IDENTIFICAR_OPORTUNIDADE"].includes(props.automacao.acaoTipo);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) props.onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-slate-950 text-white sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{props.automacao.nome}</DialogTitle>
          <DialogDescription>Simulação sem efeitos colaterais e últimas 50 execuções observáveis.</DialogDescription>
        </DialogHeader>

        {permiteSimular && (
          <section className="space-y-3 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] p-4">
            <h3 className="text-sm font-bold text-cyan-200">Simular regra</h3>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={cardId} onChange={(event) => setCardId(event.target.value)} placeholder="ID de um card deste pipeline" aria-label="Card para simulação" />
              <Button onClick={simular} disabled={simulando || !cardId.trim()}>{simulando ? "Simulando..." : "Simular sem salvar"}</Button>
            </div>
            {simulacao !== null && <pre className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-300">{JSON.stringify(simulacao, null, 2)}</pre>}
          </section>
        )}

        <section className="space-y-3">
          <h3 className="text-sm font-bold text-slate-200">Histórico</h3>
          {carregando && <p className="text-sm text-slate-500">Carregando execuções...</p>}
          {!carregando && historico.length === 0 && <p className="rounded-lg border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">Nenhuma execução registrada.</p>}
          {historico.map((item) => {
            const duracao = item.iniciadoEm && item.executadoEm
              ? Math.max(0, new Date(item.executadoEm).getTime() - new Date(item.iniciadoEm).getTime())
              : null;
            return (
              <article key={item.id} className="rounded-xl border border-white/[0.07] bg-slate-900/50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2"><Badge variant="outline">{item.status}</Badge><span className="text-xs text-slate-400">{formatarData(item.executadoEm ?? item.createdAt)}</span></div>
                  <span className="text-xs text-slate-500">{item.tentativas} tentativa(s){duracao !== null ? ` · ${duracao} ms` : ""}</span>
                </div>
                <p className="mt-2 break-all text-xs text-slate-400">Evento: {item.eventoChave} · Card: {item.cardId}</p>
                {item.mensagemErro && <p className="mt-2 text-xs text-rose-300">{item.mensagemErro}</p>}
                {item.resultadoJson && <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-950 p-2 text-[11px] text-slate-400">{item.resultadoJson}</pre>}
              </article>
            );
          })}
        </section>

        <DialogFooter><Button variant="outline" onClick={props.onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
