"use client";

import type { TemaAlpha } from "@/lib/temas";

import { GradeHoraria } from "./GradeHoraria";
import type { EventoExibicao } from "./lib/tipos";

export function VisaoDia({
  dataReferencia,
  eventos,
  tema,
  onEditarEvento,
  onEventoCancelado,
  onSelecionarHorario,
}: {
  dataReferencia: Date;
  eventos: EventoExibicao[];
  tema: TemaAlpha;
  onEditarEvento: (evento: EventoExibicao) => void;
  onEventoCancelado: () => void;
  onSelecionarHorario: (data: Date) => void;
}) {
  return (
    <GradeHoraria
      dias={[dataReferencia]}
      eventos={eventos}
      tema={tema}
      onEditarEvento={onEditarEvento}
      onEventoCancelado={onEventoCancelado}
      onSelecionarHorario={onSelecionarHorario}
    />
  );
}
