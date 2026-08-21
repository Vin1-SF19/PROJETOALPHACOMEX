"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, ChevronDown, MessageSquareText, ScrollText } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ObterCardBpm } from "@/actions/bpm/Cards";
import { CriarInteracaoCardBpm, type ListarInteracoesCardBpm } from "@/actions/bpm/Interacoes";
import { etapaEhAgendarReuniao } from "@/lib/bpm/agendar-reuniao";
import { etapaEhEmTratativa } from "@/lib/bpm/em-tratativa";
import { etapaEhStandbyFollowUp } from "@/lib/bpm/novos-leads";
import { etapaEhFechado } from "@/lib/bpm/status-pos-fechamento";
import { PainelCamposEtapaAtual } from "./PainelCamposEtapaAtual";
import { PainelChecklistFollowUp } from "./PainelChecklistFollowUp";
import { PainelProximoContato } from "./PainelProximoContato";
import { PainelContatos } from "./PainelContatos";
import PainelReuniao from "./PainelReuniao";
import { PainelStatusPosFechamento } from "./PainelStatusPosFechamento";
import { PainelStandbyFollowUp } from "./PainelStandbyFollowUp";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
type Interacao = Awaited<ReturnType<typeof ListarInteracoesCardBpm>>["data"][number];
type EtapaOpcao = { id: string; nome: string; ordem: number; script: string | null };

interface Props {
  card: CardDetalhe;
  etapaAtual: EtapaOpcao | null;
  accent: string;
  onInteracaoCriada: (interacao: Interacao) => void;
  interacoes: Interacao[];
  podeEditar: boolean;
  realtimeRevision: number;
  onAtualizado: () => void;
  onEstadoFollowUpChange: (estado: "CARREGANDO" | "ERRO" | "NAO_INICIADO" | "EM_ANDAMENTO" | "CONCLUIDO") => void;
}

const inputCls = "w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/25 transition-colors";

export default function PainelRegistrar({ card, etapaAtual, accent, onInteracaoCriada, interacoes, podeEditar, realtimeRevision, onAtualizado, onEstadoFollowUpChange }: Props) {
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
    <div
      className="relative flex min-h-0 flex-col overflow-hidden rounded-3xl border lg:h-full"
      style={{
        borderColor: `rgba(${accent},0.15)`,
        background: `linear-gradient(180deg, rgba(${accent},0.06), transparent 40%)`,
      }}
    >
      <Tabs defaultValue="formulario-etapa" className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TabsList className="mx-5 mt-5 w-auto shrink-0">
          <TabsTrigger value="formulario-etapa" className="gap-1.5">
            <CalendarClock size={13} /> Formulário da Etapa
          </TabsTrigger>
          <TabsTrigger value="script" className="gap-1.5">
            <ScrollText size={13} /> Script
          </TabsTrigger>
        </TabsList>

        <TabsContent id={`formulario-etapa-${card.id}`} value="formulario-etapa" className="m-0 mt-5 min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-5" tabIndex={-1}>
          <PainelCamposEtapaAtual
            card={card}
            accent={accent}
            podeEditar={podeEditar}
            realtimeRevision={realtimeRevision}
            onAtualizado={onAtualizado}
          />

          {etapaEhAgendarReuniao(card.etapa.nome) && (
            <PainelReuniao
              card={card}
              accent={accent}
              onAtualizado={onAtualizado}
            />
          )}

          {etapaEhFechado(card.etapa.nome) && (
            <PainelStatusPosFechamento
              cardId={card.id}
              statusPersistido={card.statusPosFechamento}
              versaoPersistidaEm={card.updatedAt}
              podeEditar={podeEditar}
              realtimeRevision={realtimeRevision}
              accent={accent}
              onAtualizado={onAtualizado}
            />
          )}

          <PainelProximoContato
            card={card}
            onAtualizado={onAtualizado}
            podeEditar={podeEditar}
            realtimeRevision={realtimeRevision}
          />

          <PainelContatos
            cardId={card.id}
            interacoes={interacoes}
            podeEditar={podeEditar}
            onInteracaoCriada={onInteracaoCriada}
          />

          {etapaEhEmTratativa(card.etapa.nome) && (
            <PainelChecklistFollowUp
              cardId={card.id}
              accent={accent}
              onAtualizado={onAtualizado}
              onEstadoChange={onEstadoFollowUpChange}
              podeEditar={podeEditar}
              realtimeRevision={realtimeRevision}
            />
          )}

          {etapaEhStandbyFollowUp(card.etapa.nome) && (
            <PainelStandbyFollowUp
              cardId={card.id}
              accent={accent}
              podeEditar={podeEditar}
              realtimeRevision={realtimeRevision}
              onAtualizado={onAtualizado}
            />
          )}

        </TabsContent>

        <TabsContent value="script" className="m-0 mt-5 min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">{etapaAtual?.nome ?? card.etapa.nome}</p>
          {etapaAtual?.script ? (
            <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{etapaAtual.script}</p>
          ) : (
            <p className="text-xs text-slate-600">Nenhum script configurado para esta etapa ainda.</p>
          )}
        </TabsContent>
      </Tabs>

      <details
        className="group sticky bottom-0 z-10 shrink-0 overflow-hidden border-t-2 backdrop-blur-xl lg:static"
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
            <MessageSquareText size={13} /> Anotação
          </span>
          <span className="flex shrink-0 items-center gap-2 text-[10px] text-slate-500">
            Aparece no histórico ao lado
            <ChevronDown size={14} className="shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
          </span>
        </summary>

        <div className="px-5 pb-4">
          <textarea
            id={`anotacao-card-${card.id}`}
            aria-label="Anotação"
            className={`${inputCls} min-h-20 resize-none`}
            placeholder="Registre uma anotação sobre este contato..."
            value={anotacao}
            onChange={(e) => setAnotacao(e.target.value)}
            disabled={!podeEditar || salvandoAnotacao}
            style={{ borderColor: `rgba(${accent},0.3)` }}
          />
          <div className="mt-2 flex items-center justify-end gap-3">
            {salvandoAnotacao && <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-500"><MessageSquareText size={13} /> Salvando...</p>}
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
    </div>
  );
}
