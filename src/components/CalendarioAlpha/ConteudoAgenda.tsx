"use client";

import type { TemaAlpha } from "@/lib/temas";

import type { VisaoCalendario } from "./lib/datas";
import type { EventoExibicao } from "./lib/tipos";
import { VisaoAno } from "./VisaoAno";
import { VisaoDia } from "./VisaoDia";
import { VisaoMes } from "./VisaoMes";
import { VisaoSemana } from "./VisaoSemana";

interface ConteudoAgendaProps {
  tema: TemaAlpha;
  visao: VisaoCalendario;
  dataReferencia: Date;
  eventos: EventoExibicao[];
  possuiCalendarios: boolean;
  onEditarEvento: (evento: EventoExibicao) => void;
  onEventoCancelado: () => void;
  onSelecionarHorario: (data: Date) => void;
  onSelecionarDia: (data: Date) => void;
  onSelecionarMes: (data: Date) => void;
  onAbrirConfiguracoes: () => void;
  onConcluirTarefa: (tarefaCacheId: string) => void;
}

export function ConteudoAgenda({
  tema,
  visao,
  dataReferencia,
  eventos,
  possuiCalendarios,
  onEditarEvento,
  onEventoCancelado,
  onSelecionarHorario,
  onSelecionarDia,
  onSelecionarMes,
  onAbrirConfiguracoes,
  onConcluirTarefa,
}: ConteudoAgendaProps) {
  if (!possuiCalendarios) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center overflow-y-auto rounded-[2rem] border border-white/5 bg-white/[0.025] px-4 py-10 text-center backdrop-blur-xl">
        <p className="text-sm font-bold text-slate-300">Nenhuma agenda selecionada</p>
        <p className="mt-1 text-xs text-slate-500">Escolha ao menos uma agenda Google para preencher a grade.</p>
        <button
          type="button"
          onClick={onAbrirConfiguracoes}
          className="mt-4 text-sm font-bold text-slate-200 underline underline-offset-4 hover:text-white"
        >
          Adicionar agenda
        </button>
      </div>
    );
  }

  if (visao === "dia") {
    return (
      <VisaoDia
        dataReferencia={dataReferencia}
        eventos={eventos}
        tema={tema}
        onEditarEvento={onEditarEvento}
        onEventoCancelado={onEventoCancelado}
        onSelecionarHorario={onSelecionarHorario}
        onConcluirTarefa={onConcluirTarefa}
      />
    );
  }

  if (visao === "semana") {
    return (
      <VisaoSemana
        dataReferencia={dataReferencia}
        eventos={eventos}
        tema={tema}
        onEditarEvento={onEditarEvento}
        onEventoCancelado={onEventoCancelado}
        onSelecionarHorario={onSelecionarHorario}
        onConcluirTarefa={onConcluirTarefa}
      />
    );
  }

  if (visao === "mes") {
    return (
      <VisaoMes
        dataReferencia={dataReferencia}
        eventos={eventos}
        tema={tema}
        onEditarEvento={onEditarEvento}
        onEventoCancelado={onEventoCancelado}
        onSelecionarDia={onSelecionarDia}
        onNovoEventoNoDia={onSelecionarHorario}
        onConcluirTarefa={onConcluirTarefa}
      />
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-contain pr-1">
      <VisaoAno
        dataReferencia={dataReferencia}
        eventos={eventos}
        tema={tema}
        onSelecionarMes={onSelecionarMes}
        onSelecionarDia={onSelecionarDia}
      />
    </div>
  );
}
