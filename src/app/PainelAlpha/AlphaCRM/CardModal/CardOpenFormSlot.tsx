"use client";

import { ObterCardBpm } from "@/actions/bpm/Cards";
import { PainelCamposEtapaAtual } from "./PainelCamposEtapaAtual";
import { PainelChecklistFollowUp } from "./PainelChecklistFollowUp";
import { PainelProximoContato } from "./PainelProximoContato";
import { PainelReuniao } from "./PainelReuniao";
import { PainelStatusPosFechamento } from "./PainelStatusPosFechamento";
import { PainelStandbyFollowUp } from "./PainelStandbyFollowUp";
import { PainelMonitoramento } from "./PainelMonitoramento";
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
  if (card.formularioEtapa.status === "MISSING") {
    return <section className="space-y-3">
      <p role="status" className="rounded-xl border border-sky-400/20 bg-sky-400/5 p-3 text-sm text-sky-100">
        Esta etapa não possui formulário próprio. {card.camposEtapa.length
          ? "Você pode revisar os dados já registrados neste card. Campos automáticos e permissões de acesso continuam sendo respeitados."
          : "Este card ainda não possui campos registrados disponíveis para edição. Anotações e tarefas continuam nos seus painéis."}
      </p>
      {card.camposEtapa.length > 0 && <PainelCamposEtapaAtual card={card} campoIds={card.camposEtapa.map((campo) => campo.id)} instanceKey="campos-registrados"
        titulo="Dados já registrados no card" accent={accent} podeEditar={podeEditar} realtimeRevision={realtimeRevision} onAtualizado={onAtualizado} />}
    </section>;
  }
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
            ocultarTitulo
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
              return <PainelReuniao card={card} accent={accent} podeEditar={podeEditar} mostrarFormulario={false} permitirReagendar onAtualizado={onAtualizado} />;
            case "follow-up-scheduler":
              return <PainelProximoContato card={card} onAtualizado={onAtualizado} podeEditar={podeEditar} realtimeRevision={realtimeRevision} />;
            case "follow-up-checklist":
              return <PainelChecklistFollowUp cardId={card.id} accent={accent} onAtualizado={onAtualizado} onEstadoChange={onEstadoFollowUpChange} podeEditar={podeEditar} realtimeRevision={realtimeRevision} />;
            case "standby-follow-up":
              return <PainelStandbyFollowUp cardId={card.id} accent={accent} podeEditar={podeEditar} realtimeRevision={realtimeRevision} onAtualizado={onAtualizado} />;
            case "monitoring-status":
              return <PainelMonitoramento cardId={card.id} realtimeRevision={realtimeRevision} />;
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
