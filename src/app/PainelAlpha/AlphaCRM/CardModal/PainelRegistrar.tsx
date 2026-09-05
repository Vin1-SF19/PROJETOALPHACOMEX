"use client";

import { useState } from "react";
import { CalendarClock, ScrollText } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ObterCardBpm } from "@/actions/bpm/Cards";
import { CardOpenFormSlot } from "./CardOpenFormSlot";













type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;
type EtapaOpcao = { id: string; nome: string; ordem: number; script: string | null };

interface Props {
  card: CardDetalhe;
  etapaAtual: EtapaOpcao | null;
  accent: string;
  podeEditar: boolean;
  realtimeRevision: number;
  onAtualizado: () => void;

}

export default function PainelRegistrar({ card, etapaAtual, accent, podeEditar, realtimeRevision, onAtualizado }: Props) {
  const [abaAtiva, setAbaAtiva] = useState("formulario-etapa");

  return (
    <div
      className="relative flex min-h-0 flex-col overflow-hidden rounded-3xl border lg:h-full"
      style={{
        borderColor: `rgba(${accent},0.15)`,
        background: `linear-gradient(180deg, rgba(${accent},0.06), transparent 40%)`,
      }}
    >
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TabsList className="mx-5 mt-5 w-auto shrink-0">
          <TabsTrigger value="formulario-etapa" className="gap-1.5">
            <CalendarClock size={13} /> Formulário da Etapa
          </TabsTrigger>
          <TabsTrigger value="script" className="gap-1.5">
            <ScrollText size={13} /> Script
          </TabsTrigger>
        </TabsList>

        <TabsContent id={`formulario-etapa-${card.id}`} value="formulario-etapa" className="m-0 mt-5 min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-5" tabIndex={-1}>
          <CardOpenFormSlot
            card={card}
            accent={accent}
            podeEditar={podeEditar}
            realtimeRevision={realtimeRevision}
            onAtualizado={onAtualizado}
          />
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

    </div>
  );
}
