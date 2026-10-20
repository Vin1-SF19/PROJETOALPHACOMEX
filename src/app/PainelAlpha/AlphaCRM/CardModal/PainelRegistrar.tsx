"use client";

import { useState } from "react";
import { CalendarClock, ScrollText } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ObterCardBpm } from "@/actions/bpm/Cards";
import { CardOpenFormSlot } from "./CardOpenFormSlot";
import { PainelAcompanhamentoContratacao } from "./PainelAcompanhamentoContratacao";
import { etapaEhFechado } from "@/lib/bpm/status-pos-fechamento";
import { ConteudoScriptEtapa } from "@/app/PainelAlpha/AlphaCRM/CardModal/ConteudoScriptEtapa";
import { PainelResumoContratacao } from "./PainelResumoContratacao";
import { PainelExcecaoOperacional } from "./PainelExcecaoOperacional";
import { isAdminRole } from "@/lib/roles";
import { PIPELINE_CHAVE } from "@/lib/bpm/financeiro-config.client";













type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
type EtapaOpcao = { id: string; chave?: string | null; nome: string; ordem: number; script: string | null };

interface Props {
  card: CardDetalhe;
  etapaAtual: EtapaOpcao | null;
  accent: string;
  podeEditar: boolean;
  realtimeRevision: number;
  onAtualizado: () => void;
  currentUserRole?: string | null;
  onEstadoFollowUpChange?: (
    estado: "CARREGANDO" | "ERRO" | "NAO_INICIADO" | "EM_ANDAMENTO" | "CONCLUIDO",
  ) => void;
}

export default function PainelRegistrar({ card, etapaAtual, accent, podeEditar, realtimeRevision, onAtualizado, currentUserRole, onEstadoFollowUpChange }: Props) {
  const [abaAtiva, setAbaAtiva] = useState("formulario-etapa");

  return (
    <div
      className="relative flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/40"
    >
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="flex min-h-0 flex-col">
        <TabsList className="mx-5 mt-5 w-auto shrink-0">
          <TabsTrigger value="formulario-etapa" className="gap-1.5">
            <CalendarClock size={13} /> Formulário da Etapa
          </TabsTrigger>
          <TabsTrigger value="script" className="gap-1.5">
            <ScrollText size={13} /> Orientações da etapa
          </TabsTrigger>
        </TabsList>

        <TabsContent id={`formulario-etapa-${card.id}`} value="formulario-etapa" className="m-0 mt-5 flex-none space-y-4 px-5 pb-5" tabIndex={-1}>
          {etapaEhFechado(card.etapa.nome, card.etapa.chave) && (card.pipeline.chave === "comercial" || card.pipeline.nome === "Revisão de Radar")
            && <PainelAcompanhamentoContratacao key={card.id} cardId={card.id} realtimeRevision={realtimeRevision} onAtualizado={onAtualizado} />}
          {card.resumoContratacao && <PainelResumoContratacao resumo={card.resumoContratacao} />}
          {card.pipeline.chave === PIPELINE_CHAVE && card.resumoContratacao && !card.resumoContratacao.operacionalCardId && isAdminRole(currentUserRole)
            && <PainelExcecaoOperacional cardId={card.id} onAtualizado={onAtualizado} />}
          <CardOpenFormSlot
            card={card}
            accent={accent}
            podeEditar={podeEditar}
            realtimeRevision={realtimeRevision}
            onAtualizado={onAtualizado}
            onEstadoFollowUpChange={onEstadoFollowUpChange}
          />
        </TabsContent>

        <TabsContent value="script" className="m-0 mt-5 flex-none px-5 pb-5">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">{etapaAtual?.nome ?? card.etapa.nome}</p>
          {etapaAtual?.script ? (
            <ConteudoScriptEtapa key={etapaAtual.id} script={etapaAtual.script} />
          ) : (
            <p className="text-xs text-slate-600">Nenhuma orientação configurada para esta etapa.</p>
          )}
        </TabsContent>
      </Tabs>

    </div>
  );
}
