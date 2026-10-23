"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import { ObterCardBpm } from "@/actions/bpm/Cards";
import { ObterOpcoesEncaminhamentoManualBpm, ObterResponsaveisEncaminhamentoManualBpm, EncaminharCardManualmenteBpm } from "@/actions/bpm/EncaminhamentoManual";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ComandoEncaminhamentoManual } from "@/lib/bpm/encaminhamento-manual";
import { useCardSave } from "./CardSaveContext";

type Card = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
const seletor = "min-h-11 w-full rounded-lg border border-white/20 bg-slate-900 px-3 text-sm text-white disabled:opacity-50";

export function EncaminhamentoManualDialog({ card, realtimeRevision, bloqueado, onAtualizado }: {
  card: Card; realtimeRevision: number; bloqueado: boolean; onAtualizado: () => void;
}) {
  const { flushSaves } = useCardSave();
  const [aberto, setAberto] = useState(false);
  const [pipelineId, setPipelineId] = useState(card.pipelineId);
  const [etapaId, setEtapaId] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const operacao = useRef(false);
  const chave = useRef("");
  const comando = useRef<ComandoEncaminhamentoManual | null>(null);
  const consulta = useQuery({ queryKey: ["crm-encaminhamento-manual", card.id, card.versao, realtimeRevision], retry: false,
    queryFn: async () => {
      const resultado = await ObterOpcoesEncaminhamentoManualBpm(card.id);
      if (!resultado.success) throw new Error(resultado.error);
      return resultado.data;
    } });
  const outroPipeline = Boolean(pipelineId) && pipelineId !== card.pipelineId;
  const pipeline = consulta.data?.pipelines.find(item => item.id === pipelineId);

  const consultarPessoas = aberto && outroPipeline && Boolean(pipelineId && etapaId);
  const pessoas = useQuery({ queryKey: ["crm-responsaveis-encaminhamento-manual", card.id, pipelineId, etapaId], enabled: consultarPessoas, retry: false,
    queryFn: async () => {
      const resultado = await ObterResponsaveisEncaminhamentoManualBpm({ cardId: card.id, pipelineId, etapaId });
      if (!resultado.success) throw new Error(resultado.error);
      return resultado.data;
    } });
  const responsaveis = pessoas.data ?? [];
  const carregandoPessoas = consultarPessoas && pessoas.isPending;

  function abrir() {
    setPipelineId(card.pipelineId); setEtapaId(""); setResponsavelId("");
    setErro(null); chave.current = crypto.randomUUID(); comando.current = null; setAberto(true);
    void consulta.refetch();
  }
  function mudarPipeline(valor: string) {
    setPipelineId(valor); setEtapaId(""); setResponsavelId("");
    setErro(null); chave.current = crypto.randomUUID(); comando.current = null;
  }
  async function confirmar() {
    if (operacao.current) return;
    if (!pipelineId || !etapaId || outroPipeline && !responsavelId) { setErro("Selecione o pipeline, a etapa e o responsável de destino quando necessário."); return; }
    operacao.current = true; setEnviando(true); setErro(null);
    try {
      if (!comando.current) {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        if (!await flushSaves(card.id)) throw new Error("Salve ou descarte as alterações pendentes antes de encaminhar.");
        const atual = await ObterCardBpm(card.id);
        if (!atual.success || !atual.data) throw new Error("Não foi possível confirmar o estado do card.");
        if (atual.data.pipelineId !== card.pipelineId || atual.data.etapa.id !== card.etapa.id) throw new Error("O card mudou de etapa. Reabra o encaminhamento.");
        comando.current = { cardId: card.id, pipelineDestinoId: pipelineId, etapaDestinoId: etapaId,
          ...(outroPipeline ? { responsavelDestinoId: Number(responsavelId) } : {}), etapaOrigemEsperadaId: atual.data.etapa.id,
          versaoEsperada: atual.data.versao, idempotencyKey: chave.current };
      }
      // Resposta perdida: o retry conserva exatamente a solicitação já enviada.
      const resultado = await EncaminharCardManualmenteBpm(comando.current);
      if (!resultado.success) throw new Error(resultado.error);
      toast.success(resultado.data.mesmoPipeline ? "Card movido para a etapa selecionada." : "Card encaminhado e atribuído ao responsável selecionado.");
      setAberto(false); onAtualizado(); void consulta.refetch();
    } catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível encaminhar o card."); }
    finally { operacao.current = false; setEnviando(false); }
  }
  if (!consulta.data?.permitido) return null;
  return <>
    <button type="button" onClick={abrir} disabled={bloqueado || enviando} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-cyan-400 px-3 text-sm font-bold text-slate-950 shadow-sm hover:bg-cyan-300 disabled:opacity-50">
      <SendHorizontal size={16} aria-hidden="true" /> Encaminhar manualmente
    </button>
    <Dialog open={aberto} onOpenChange={valor => { if (!enviando) setAberto(valor); }}>
      <DialogContent className="border-white/15 bg-slate-950 text-slate-100 sm:max-w-lg">
        <DialogHeader><DialogTitle>Encaminhamento manual</DialogTitle>
          <DialogDescription className="text-slate-400">Escolha para onde encaminhar este card.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <label className="block space-y-2 text-sm font-medium">Pipeline
            <select aria-label="Pipeline de destino" className={seletor} value={pipelineId} disabled={enviando} onChange={event => mudarPipeline(event.target.value)}>
              <option value="">Selecione o pipeline</option>
              {consulta.data.pipelines.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <label className="block space-y-2 text-sm font-medium">Etapa
            <select aria-label="Etapa de destino" className={seletor} value={etapaId} disabled={!pipeline || enviando} onChange={event => {
              setEtapaId(event.target.value); setResponsavelId(""); setErro(null); chave.current = crypto.randomUUID(); comando.current = null;
            }}>
              <option value="">Selecione a etapa</option>
              {pipeline?.etapas.map(item => <option key={item.id} value={item.id} disabled={!outroPipeline && item.id === card.etapa.id}>{item.nome}{!outroPipeline && item.id === card.etapa.id ? " (etapa atual)" : ""}</option>)}
            </select>
          </label>
          {outroPipeline && <label className="block space-y-2 text-sm font-medium">Responsável no próximo pipeline
            <select aria-label="Responsável no pipeline de destino" className={seletor} value={responsavelId} disabled={!etapaId || carregandoPessoas || enviando} onChange={event => { setResponsavelId(event.target.value); chave.current = crypto.randomUUID(); comando.current = null; }}>
              <option value="">{carregandoPessoas ? "Carregando responsáveis…" : "Selecione o responsável"}</option>
              {responsaveis.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
            {etapaId && !carregandoPessoas && responsaveis.length === 0 && <span className="block text-xs text-amber-200">Nenhum responsável elegível disponível para esta etapa.</span>}
          </label>}
          <p className="rounded-lg bg-white/5 p-3 text-xs text-slate-300">{outroPipeline
            ? "Será criado um card vinculado no destino, atribuído ao responsável escolhido. O card de origem e seu histórico serão preservados."
            : "O card será movido para a etapa escolhida e continuará com o responsável atual."}</p>
          {consultarPessoas && pessoas.isError && <p role="alert" className="text-sm text-amber-200">Não foi possível carregar os responsáveis. Selecione a etapa novamente para tentar.</p>}
          {erro && <p role="alert" className="text-sm text-amber-200">{erro}</p>}
        </div>
        <DialogFooter>
          <button type="button" disabled={enviando} onClick={() => setAberto(false)} className="min-h-11 rounded-lg border border-white/20 px-4 text-sm">Cancelar</button>
          <button type="button" disabled={enviando || !etapaId || outroPipeline && (!responsavelId || carregandoPessoas)} onClick={() => void confirmar()} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-cyan-400 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50">
            {enviando && <Loader2 className="animate-spin" size={15} aria-hidden="true" />}{enviando ? "Encaminhando…" : "Confirmar encaminhamento"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
