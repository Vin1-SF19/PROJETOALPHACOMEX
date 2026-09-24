"use client";

import { ObterCardBpm } from "@/actions/bpm/Cards";
import { PainelCamposEtapaAtual } from "./PainelCamposEtapaAtual";
import { PainelChecklistFollowUp } from "./PainelChecklistFollowUp";
import { PainelProximoContato } from "./PainelProximoContato";
import { PainelReuniao } from "./PainelReuniao";
import { PainelStatusPosFechamento } from "./PainelStatusPosFechamento";
import { PainelStandbyFollowUp } from "./PainelStandbyFollowUp";
import { FormularioEtapaRenderer } from "./FormularioEtapaRenderer";

type CardDetalhe = NonNullable<Awaited<ReturnType<typeof ObterCardBpm>>["data"]>;

export interface CardOpenFormSlotProps {
  card: CardDetalhe;
  accent: string;
  podeEditar: boolean;
  realtimeRevision: number;
  onAtualizado: () => void;
  onEstadoFollowUpChange?: (
    estado: "CARREGANDO" | "ERRO" | "NAO_INICIADO" | "EM_ANDAMENTO" | "CONCLUIDO",
  ) => void;
}

export function CardOpenFormSlot({
  card,
  accent,
  podeEditar,
  realtimeRevision,
  onAtualizado,
  onEstadoFollowUpChange = () => {},
}: CardOpenFormSlotProps) {
  const formulario = {
    ...card.formularioEtapa,
    secoes: card.formularioEtapa.secoes
      .map((secao) => ({
        ...secao,
        componentes: secao.componentes.filter((componente) => componente.rendererId !== "stage-checklist"),
      }))
      .filter((secao) => secao.componentes.length > 0),
  };

  return (
    <FormularioEtapaRenderer
      formulario={formulario}
      mode="runtime"
      bindings={{
        renderCampos: ({ campoIds, campoLabels, secaoTitulo, runKey }) => (
          <PainelCamposEtapaAtual
            card={card}
            campoIds={campoIds}
            campoLabels={campoLabels}
            instanceKey={runKey}
            titulo={secaoTitulo}
            accent={accent}
            podeEditar={podeEditar}
            realtimeRevision={realtimeRevision}
            onAtualizado={onAtualizado}
          />
        ),
        renderComponente: (componente) => {
          switch (componente.rendererId) {
            case "meeting-scheduler":
              return <PainelReuniao card={card} accent={accent} podeEditar={podeEditar} onAtualizado={onAtualizado} />;
            case "meeting-transcript":
              return <PainelReuniao card={card} accent={accent} podeEditar={podeEditar} mostrarFormulario={false} onAtualizado={onAtualizado} />;
            case "follow-up-scheduler":
              return <PainelProximoContato card={card} onAtualizado={onAtualizado} podeEditar={podeEditar} realtimeRevision={realtimeRevision} />;
            case "follow-up-checklist":
              return <PainelChecklistFollowUp cardId={card.id} accent={accent} onAtualizado={onAtualizado} onEstadoChange={onEstadoFollowUpChange} podeEditar={podeEditar} realtimeRevision={realtimeRevision} />;
            case "standby-follow-up":
              return <PainelStandbyFollowUp cardId={card.id} accent={accent} podeEditar={podeEditar} realtimeRevision={realtimeRevision} onAtualizado={onAtualizado} />;
            case "commercial-post-closing":
              return <PainelStatusPosFechamento cardId={card.id} statusPersistido={card.statusPosFechamento} versaoPersistidaEm={card.updatedAt} podeEditar={podeEditar} realtimeRevision={realtimeRevision} accent={accent} onAtualizado={onAtualizado} />;
            default:
              return null;
          }
        },
      }}
    />
  );
}
