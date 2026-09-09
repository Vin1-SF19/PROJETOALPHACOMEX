"use client";

import { Building2, CheckCircle2, Eye, Plus, Sparkles } from "lucide-react";

import type { TemaAlpha } from "@/lib/temas";
import { cn } from "@/lib/utils";

import { DetalhePopover } from "./DetalhePopover";
import { DiaEventosPopover } from "./DiaEventosPopover";
import {
  agruparPorDia,
  diasDoGridMes,
  formatarDataCivil,
  formatarHora,
  FUSO_HORARIO_AGENDA_ALPHA,
  mesmodia,
} from "./lib/datas";
import { corDoItemAgenda, FUNDO_TAREFA_CONCLUIDA, type EventoExibicao } from "./lib/tipos";

const DIAS_SEMANA = ["Dom.", "Seg.", "Ter.", "Qua.", "Qui.", "Sex.", "Sáb."];
const LIMITE_EVENTOS_VISIVEIS = 2;
const FORMATADOR_MES_ABREVIADO = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  timeZone: FUSO_HORARIO_AGENDA_ALPHA,
});

function rotuloNumeroDia(dia: Date, chave: string): string {
  const numero = Number(chave.slice(8, 10));
  if (numero !== 1) return String(numero);

  const mes = FORMATADOR_MES_ABREVIADO.format(dia).replace(/\.$/, "");
  return `${numero} ${mes}.`;
}

function formatarHoraCompacta(data: Date): string {
  const horario = formatarHora(data).replace(/^0/, "");
  return horario.endsWith(":00") ? `${horario.slice(0, -3)}h` : horario;
}

function TarefaDoMes({
  evento,
  onEditarEvento,
  onConcluirTarefa,
}: {
  evento: EventoExibicao;
  onEditarEvento: (evento: EventoExibicao) => void;
  onConcluirTarefa: (tarefaCacheId: string) => void;
}) {
  const concluida = evento.status === "completed";
  const cor = corDoItemAgenda(evento);

  return (
    <div
      className={cn(
        "group/task flex h-7 w-full items-center gap-1.5 overflow-hidden rounded-md px-1.5 text-[11px] font-semibold text-white transition-[filter,transform] hover:-translate-y-px hover:brightness-110",
        concluida && "text-slate-400",
        evento.sincronizacaoPendente && "animate-pulse",
      )}
      style={{
        background: concluida
          ? FUNDO_TAREFA_CONCLUIDA
          : `linear-gradient(90deg, ${cor}b8, ${cor}8f)`,
      }}
    >
      {concluida ? (
        <span
          className="flex size-4 shrink-0 items-center justify-center rounded-full text-slate-300"
          title="Tarefa concluída"
        >
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
        </span>
      ) : !evento.calendarioGravavel ? (
        <span
          role="img"
          aria-label="Tarefa do chamado — somente leitura"
          className="flex size-4 shrink-0 items-center justify-center rounded-full text-sky-100"
          title="Tarefa do chamado — somente leitura"
        >
          <Eye className="size-3.5" aria-hidden="true" />
        </span>
      ) : (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (evento.tarefaCacheId) onConcluirTarefa(evento.tarefaCacheId);
          }}
          className="flex size-4 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label={`Concluir tarefa: ${evento.titulo || "sem título"}`}
          title="Concluir tarefa"
        >
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
        </button>
      )}

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onEditarEvento(evento);
        }}
        className={cn(
          "min-w-0 flex-1 truncate text-left focus:outline-none focus-visible:underline",
          concluida && "line-through decoration-slate-400",
        )}
        title={evento.titulo || "(sem título)"}
      >
        {evento.titulo || "(sem título)"}
      </button>
    </div>
  );
}

function EventoDoMes({
  evento,
  tema,
  onEditarEvento,
  onEventoCancelado,
}: {
  evento: EventoExibicao;
  tema: TemaAlpha;
  onEditarEvento: (evento: EventoExibicao) => void;
  onEventoCancelado: () => void;
}) {
  const cor = corDoItemAgenda(evento);
  const localDeTrabalho = evento.eventType === "workingLocation";
  const titulo = evento.titulo || "(sem título)";

  return (
    <DetalhePopover
      evento={evento}
      tema={tema}
      onEditar={onEditarEvento}
      onCancelado={onEventoCancelado}
    >
      <button
        type="button"
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "group/event flex h-7 w-full items-center gap-1.5 overflow-hidden rounded-md px-1.5 text-left text-[11px] font-semibold transition-colors hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40",
          evento.diaInteiro && !localDeTrabalho && "text-white hover:brightness-110",
          !evento.diaInteiro && "text-slate-100",
          evento.recusadoPeloUsuario && "opacity-50 grayscale line-through",
          evento.sincronizacaoPendente && "animate-pulse",
        )}
        style={evento.diaInteiro && !localDeTrabalho
          ? { background: `linear-gradient(90deg, ${cor}c7, ${cor}9e)` }
          : undefined}
        title={evento.recusadoPeloUsuario ? `${titulo} — convite recusado` : titulo}
      >
        {localDeTrabalho ? (
          <>
            <span
              className="flex size-5 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `${cor}42`, color: cor }}
              aria-hidden="true"
            >
              <Building2 className="size-3" />
            </span>
            <span className="truncate font-bold text-slate-100">{titulo}</span>
          </>
        ) : evento.diaInteiro ? (
          <span className="truncate">{titulo}</span>
        ) : (
          <>
            <span
              className="size-2 shrink-0 rounded-full border"
              style={{
                backgroundColor: evento.compartilhadoComUsuario ? "transparent" : cor,
                borderColor: cor,
              }}
              aria-hidden="true"
            />
            <span className="shrink-0 font-bold text-slate-200">
              {evento.inicioEm ? formatarHoraCompacta(new Date(evento.inicioEm)) : "—"}
            </span>
            {evento.eventType === "focusTime" && (
              <Sparkles className="size-3 shrink-0" style={{ color: cor }} aria-hidden="true" />
            )}
            <span className="truncate font-bold text-slate-100">{titulo}</span>
          </>
        )}
      </button>
    </DetalhePopover>
  );
}

export function VisaoMes({
  dataReferencia,
  eventos,
  tema,
  onEditarEvento,
  onEventoCancelado,
  onSelecionarDia,
  onNovoEventoNoDia,
  onConcluirTarefa,
}: {
  dataReferencia: Date;
  eventos: EventoExibicao[];
  tema: TemaAlpha;
  onEditarEvento: (evento: EventoExibicao) => void;
  onEventoCancelado: () => void;
  onSelecionarDia: (data: Date) => void;
  onNovoEventoNoDia: (data: Date) => void;
  onConcluirTarefa: (tarefaCacheId: string) => void;
}) {
  const dias = diasDoGridMes(dataReferencia);
  const eventosPorDia = agruparPorDia(eventos);
  const hoje = new Date();
  const mesReferenciaCivil = formatarDataCivil(dataReferencia).slice(0, 7);
  const numeroSemanas = dias.length / 7;

  return (
    <div className="h-full min-h-0 overflow-auto rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))] shadow-2xl shadow-slate-950/20">
      <div
        role="grid"
        aria-label="Calendário mensal"
        className="grid h-full min-h-[640px] min-w-[760px] grid-cols-7"
        style={{ gridTemplateRows: `repeat(${numeroSemanas}, minmax(8rem, 1fr))` }}
      >
        {dias.map((dia, indice) => {
          const chave = formatarDataCivil(dia);
          const eventosDoDia = eventosPorDia.get(chave) ?? [];
          const foraDoMes = chave.slice(0, 7) !== mesReferenciaCivil;
          const ehHoje = mesmodia(dia, hoje);
          const primeiraSemana = indice < 7;
          const ultimaColuna = indice % 7 === 6;
          const ultimaLinha = indice >= dias.length - 7;

          return (
            <div
              key={chave}
              role="gridcell"
              onClick={() => onSelecionarDia(dia)}
              className={cn(
                "group/dia relative min-h-0 overflow-hidden p-2.5 text-left align-top transition-colors duration-150 hover:z-10 hover:bg-white/[0.035]",
                !ultimaColuna && "border-r border-white/[0.11]",
                !ultimaLinha && "border-b border-white/[0.11]",
              )}
            >
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelecionarDia(dia);
                }}
                className={cn(
                  "mx-auto flex min-h-8 min-w-8 flex-col items-center justify-center rounded-full px-1 text-xs font-bold text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
                  primeiraSemana && "min-h-[3.5rem] justify-start gap-1 rounded-xl",
                  ehHoje && !primeiraSemana && "bg-[#8ab4f8] text-[#10233f]",
                  foraDoMes && !ehHoje && "text-slate-500",
                )}
                aria-label={`Ver ${dia.toLocaleDateString("pt-BR")}${eventosDoDia.length ? `, ${eventosDoDia.length} compromisso(s)` : ""}`}
              >
                {primeiraSemana && (
                  <span className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                    {DIAS_SEMANA[indice]}
                  </span>
                )}
                <span
                  className={cn(
                    "inline-flex min-h-7 min-w-7 items-center justify-center rounded-full px-1",
                    ehHoje && "bg-[#8ab4f8] text-[#10233f] shadow-[0_0_18px_rgba(138,180,248,0.24)]",
                  )}
                >
                  {rotuloNumeroDia(dia, chave)}
                </span>
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onNovoEventoNoDia(dia);
                }}
                aria-label={`Novo evento em ${dia.toLocaleDateString("pt-BR")}`}
                title="Novo evento"
                className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-md text-slate-500 opacity-0 transition-[color,background-color,opacity] hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 group-hover/dia:opacity-100 focus-visible:opacity-100"
              >
                <Plus className="size-3.5" aria-hidden="true" />
              </button>

              <div className={cn("space-y-1", primeiraSemana ? "mt-0.5" : "mt-2")}>
                {eventosDoDia.slice(0, LIMITE_EVENTOS_VISIVEIS).map((evento) => evento.tipo === "tarefa" ? (
                  <TarefaDoMes
                    key={evento.id}
                    evento={evento}
                    onEditarEvento={onEditarEvento}
                    onConcluirTarefa={onConcluirTarefa}
                  />
                ) : (
                  <EventoDoMes
                    key={evento.id}
                    evento={evento}
                    tema={tema}
                    onEditarEvento={onEditarEvento}
                    onEventoCancelado={onEventoCancelado}
                  />
                ))}

                {eventosDoDia.length > LIMITE_EVENTOS_VISIVEIS && (
                  <DiaEventosPopover
                    dia={dia}
                    eventos={eventosDoDia}
                    onEditarEvento={onEditarEvento}
                    onConcluirTarefa={onConcluirTarefa}
                  >
                    <button
                      type="button"
                      onClick={(event) => event.stopPropagation()}
                      className="block w-full rounded-md px-1.5 py-0.5 text-left text-[11px] font-bold text-slate-300 transition-colors hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    >
                      Mais {eventosDoDia.length - LIMITE_EVENTOS_VISIVEIS}
                    </button>
                  </DiaEventosPopover>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
