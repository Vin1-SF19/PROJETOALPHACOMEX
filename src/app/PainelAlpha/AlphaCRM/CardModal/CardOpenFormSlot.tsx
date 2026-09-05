"use client";

import { ObterCardBpm } from "@/actions/bpm/Cards";
import { etapaEhAgendarReuniao } from "@/lib/bpm/agendar-reuniao";
import { etapaEhEmTratativa } from "@/lib/bpm/em-tratativa";
import { etapaEhStandbyFollowUp } from "@/lib/bpm/novos-leads";
import { etapaEhReuniaoAgendada } from "@/lib/bpm/reuniao-agendada";
import { etapaEhFechado } from "@/lib/bpm/status-pos-fechamento";
import { PainelCamposEtapaAtual } from "./PainelCamposEtapaAtual";
import { PainelChecklistFollowUp } from "./PainelChecklistFollowUp";
import { PainelProximoContato } from "./PainelProximoContato";
import { PainelReuniao } from "./PainelReuniao";
import { PainelStatusPosFechamento } from "./PainelStatusPosFechamento";
import { PainelStandbyFollowUp } from "./PainelStandbyFollowUp";

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

/**
 * Slot de formulário do card aberto.
 *
 * Seleciona e renderiza os painéis de formulário específicos da etapa ativa,
 * reaproveitando os componentes `Painel*` existentes. A lógica de seleção
 * (condicionais `etapaEh*`) fica isolada aqui, fora do `PainelRegistrar`.
 */
export function CardOpenFormSlot({
  card,
  accent,
  podeEditar,
  realtimeRevision,
  onAtualizado,
  onEstadoFollowUpChange = () => {},
}: CardOpenFormSlotProps) {
  if (etapaEhAgendarReuniao(card.etapa.nome)) {
    return (
      <PainelReuniao
        card={card}
        accent={accent}
        podeEditar={podeEditar}
        onAtualizado={onAtualizado}
      />
    );
  }

  return (
    <>
      <PainelCamposEtapaAtual
        card={card}
        accent={accent}
        podeEditar={podeEditar}
        realtimeRevision={realtimeRevision}
        onAtualizado={onAtualizado}
      />

      {etapaEhReuniaoAgendada(card.etapa.nome) && (
        <PainelReuniao
          card={card}
          accent={accent}
          podeEditar={podeEditar}
          mostrarFormulario={false}
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
    </>
  );
}
