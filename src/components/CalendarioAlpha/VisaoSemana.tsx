"use client";

import type { TemaAlpha } from "@/lib/temas";

import { GradeHoraria } from "./GradeHoraria";
import { diasDaSemana } from "./lib/datas";
import type { EventoExibicao } from "./lib/tipos";

export function VisaoSemana({
  dataReferencia,
  eventos,
  tema,
  onEditarEvento,
  onEventoCancelado,
  onSelecionarHorario,
  onConcluirTarefa,
}: {
  dataReferencia: Date;
  eventos: EventoExibicao[];
  tema: TemaAlpha;
  onEditarEvento: (evento: EventoExibicao) => void;
  onEventoCancelado: () => void;
  onSelecionarHorario: (data: Date) => void;
  onConcluirTarefa: (tarefaCacheId: string) => void;
}) {
  return (
    <GradeHoraria
      dias={diasDaSemana(dataReferencia)}
      eventos={eventos}
      tema={tema}
      onEditarEvento={onEditarEvento}
      onEventoCancelado={onEventoCancelado}
      onSelecionarHorario={onSelecionarHorario}
      onConcluirTarefa={onConcluirTarefa}
    />
  );
}
