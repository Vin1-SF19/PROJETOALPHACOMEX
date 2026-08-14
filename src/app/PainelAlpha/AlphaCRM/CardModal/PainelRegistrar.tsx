"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, ScrollText } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ObterCardBpm } from "@/actions/bpm/Cards";
import { CriarInteracaoCardBpm, type ListarInteracoesCardBpm } from "@/actions/bpm/Interacoes";
import { etapaEhAgendarReuniao } from "@/lib/bpm/agendar-reuniao";
import { etapaEhEmTratativa, etapaExigeProximoContato } from "@/lib/bpm/em-tratativa";
import { etapaEhStandbyFollowUp } from "@/lib/bpm/novos-leads";
import { etapaEhFechado } from "@/lib/bpm/status-pos-fechamento";
import { PainelCamposEtapaAtual } from "./PainelCamposEtapaAtual";
import { PainelChecklistFollowUp } from "./PainelChecklistFollowUp";
import { PainelProximoContato } from "./PainelProximoContato";
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
  podeEditar: boolean;
  realtimeRevision: number;
  onAtualizado: () => void;
  onEstadoFollowUpChange: (estado: "CARREGANDO" | "ERRO" | "NAO_INICIADO" | "EM_ANDAMENTO" | "CONCLUIDO") => void;
}

const inputCls = "w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-white/25 transition-colors";

export default function PainelRegistrar({ card, etapaAtual, accent, onInteracaoCriada, podeEditar, realtimeRevision, onAtualizado, onEstadoFollowUpChange }: Props) {
  const [agendaData, setAgendaData] = useState("");
  const [agendaHora, setAgendaHora] = useState("");
  const [agendaLink, setAgendaLink] = useState("");
  const [anotacao, setAnotacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function handleSalvar() {
    setSalvando(true);
    let agendadoEm: Date | undefined;
    if (agendaData) agendadoEm = new Date(`${agendaData}T${agendaHora || "00:00"}`);

    const res = await CriarInteracaoCardBpm({
      cardId: card.id,
      agendadoEm,
      agendaLink: agendaLink.trim() || undefined,
      observacoes: anotacao.trim() || undefined,
    });
    setSalvando(false);

    if (res.success && res.data) {
      toast.success("Interação registrada");
      onInteracaoCriada(res.data as unknown as Interacao);
      setAgendaData("");
      setAgendaHora("");
      setAgendaLink("");
      setAnotacao("");
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Erro ao registrar interação");
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

          {etapaExigeProximoContato(card.etapa.nome) && (
            <PainelProximoContato
              card={card}
              accent={accent}
              onAtualizado={onAtualizado}
              podeEditar={podeEditar}
              realtimeRevision={realtimeRevision}
            />
          )}

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

          <div className="border-t border-white/5 pt-4">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">Registrar interação</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-400 font-medium block mb-1.5">Data</label>
              <input type="date" className={inputCls} value={agendaData} onChange={(e) => setAgendaData(e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 font-medium block mb-1.5">Hora</label>
              <input type="time" className={inputCls} value={agendaHora} onChange={(e) => setAgendaHora(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-slate-400 font-medium block mb-1.5">Link</label>
            <input type="url" className={inputCls} placeholder="https://..." value={agendaLink} onChange={(e) => setAgendaLink(e.target.value)} />
          </div>
          </div>
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

      <footer className="sticky bottom-0 z-10 shrink-0 border-t border-white/[0.08] bg-slate-950/95 px-5 py-4 backdrop-blur-xl lg:static">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={`anotacao-card-${card.id}`} className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Anotação</label>
          <span className="text-[10px] text-slate-600">Visível em todas as etapas</span>
        </div>
        <textarea
          id={`anotacao-card-${card.id}`}
          className={`${inputCls} mt-2 min-h-20 resize-none`}
          placeholder="Registre uma anotação sobre este contato..."
          value={anotacao}
          onChange={(e) => setAnotacao(e.target.value)}
          disabled={!podeEditar || salvando}
        />
        <button
          onClick={handleSalvar}
          disabled={!podeEditar || salvando}
          className="mt-3 w-full rounded-xl py-3 text-sm font-bold text-white shadow-lg transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: `rgb(${accent})`, boxShadow: `0 8px 24px -8px rgba(${accent},0.6)` }}
        >
          {salvando ? "Salvando..." : "Registrar interação"}
        </button>
      </footer>
    </div>
  );
}
