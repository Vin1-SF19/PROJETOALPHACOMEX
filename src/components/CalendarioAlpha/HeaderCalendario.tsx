"use client";

import { type ReactNode } from "react";
import {
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Grid3x3,
  Menu,
  Settings2,
} from "lucide-react";

import type { TemaAlpha } from "@/lib/temas";
import { cn } from "@/lib/utils";

import {
  formatarTituloAno,
  formatarTituloDia,
  formatarTituloMes,
  formatarTituloSemana,
  type VisaoCalendario,
} from "./lib/datas";

interface HeaderCalendarioProps {
  tema: TemaAlpha;
  visao: VisaoCalendario;
  dataReferencia: Date;
  status: ReactNode;
  onMudarVisao: (visao: VisaoCalendario) => void;
  onHoje: () => void;
  onAnterior: () => void;
  onProximo: () => void;
  onNovoEvento: () => void;
  onAbrirSidebar: () => void;
  onAbrirConfiguracoes: () => void;
  onAbrirTutorial: () => void;
}

const OPCOES_VISAO: { visao: VisaoCalendario; label: string; Icon: typeof CalendarDays }[] = [
  { visao: "dia", label: "Dia", Icon: CalendarDays },
  { visao: "semana", label: "Semana", Icon: CalendarRange },
  { visao: "mes", label: "Mês", Icon: Grid3x3 },
  { visao: "ano", label: "Ano", Icon: Grid3x3 },
];

function tituloDaVisao(visao: VisaoCalendario, dataReferencia: Date): string {
  if (visao === "dia") return formatarTituloDia(dataReferencia);
  if (visao === "semana") return formatarTituloSemana(dataReferencia);
  if (visao === "ano") return formatarTituloAno(dataReferencia);
  return formatarTituloMes(dataReferencia);
}

function BotaoIcone({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.025] text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 lg:size-9"
    >
      {children}
    </button>
  );
}

export function HeaderCalendario({
  tema,
  visao,
  dataReferencia,
  status,
  onMudarVisao,
  onHoje,
  onAnterior,
  onProximo,
  onNovoEvento,
  onAbrirSidebar,
  onAbrirConfiguracoes,
  onAbrirTutorial,
}: HeaderCalendarioProps) {
  return (
    <header className="mb-3 shrink-0 rounded-[1.75rem] border border-white/10 bg-slate-950/55 p-2.5 shadow-2xl backdrop-blur-2xl sm:p-3 [@media(max-height:760px)]:mb-2 [@media(max-height:760px)]:py-2">
      <div className="flex items-center gap-2">
        <div className="lg:hidden">
          <BotaoIcone label="Abrir agendas" onClick={onAbrirSidebar}>
            <Menu className="size-4" />
          </BotaoIcone>
        </div>

        <div className="min-w-0 flex-1" data-guia-agenda="visao-geral">
          <div className="flex items-center gap-2">
            <CalendarDays className={cn("hidden size-5 shrink-0 sm:block", tema.text)} aria-hidden="true" />
            <div className="min-w-0">
              <h1 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                Agenda Alpha
              </h1>
              <p className="truncate text-sm font-black capitalize tracking-tight text-white sm:text-lg">
                {tituloDaVisao(visao, dataReferencia)}
              </p>
            </div>
          </div>
        </div>

        <div className="hidden items-center gap-2 lg:flex" data-guia-agenda="navegacao-data">
          <button
            type="button"
            onClick={onHoje}
            className="min-h-10 rounded-xl border border-white/10 bg-white/[0.025] px-3 text-xs font-black uppercase tracking-wide text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 lg:min-h-9"
          >
            Hoje
          </button>
          <BotaoIcone label="Período anterior" onClick={onAnterior}>
            <ChevronLeft className="size-4" />
          </BotaoIcone>
          <BotaoIcone label="Próximo período" onClick={onProximo}>
            <ChevronRight className="size-4" />
          </BotaoIcone>
        </div>

        <div data-guia-agenda="status-sincronizacao">{status}</div>

        <div className="hidden lg:block">
          <BotaoIcone label="Gerenciar agendas" onClick={onAbrirConfiguracoes}>
            <Settings2 className="size-4" />
          </BotaoIcone>
        </div>

        <div className="hidden lg:block">
          <BotaoIcone label="Como usar a Agenda Alpha" onClick={onAbrirTutorial}>
            <CircleHelp className="size-4" />
          </BotaoIcone>
        </div>

        <button
          type="button"
          onClick={onNovoEvento}
          data-guia-agenda="criar-evento"
          className={cn(
            "flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-black uppercase tracking-wide text-white transition-transform hover:scale-[1.02] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 sm:px-4 lg:min-h-9",
            tema.bg,
          )}
        >
          <CalendarPlus className="size-4" />
          <span className="hidden sm:inline">Criar</span>
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-0.5 lg:justify-end">
        <div className="flex items-center gap-1 lg:hidden">
          <button
            type="button"
            onClick={onHoje}
            className="min-h-9 rounded-xl border border-white/10 bg-white/[0.025] px-3 text-[11px] font-bold text-slate-300"
          >
            Hoje
          </button>
          <BotaoIcone label="Período anterior" onClick={onAnterior}>
            <ChevronLeft className="size-4" />
          </BotaoIcone>
          <BotaoIcone label="Próximo período" onClick={onProximo}>
            <ChevronRight className="size-4" />
          </BotaoIcone>
          <BotaoIcone label="Como usar a Agenda Alpha" onClick={onAbrirTutorial}>
            <CircleHelp className="size-4" />
          </BotaoIcone>
        </div>

        <div className="flex shrink-0 items-center rounded-xl border border-white/10 bg-white/[0.025] p-0.5" data-guia-agenda="trocar-visao">
          {OPCOES_VISAO.map(({ visao: opcao, label, Icon }) => (
            <button
              key={opcao}
              type="button"
              onClick={() => onMudarVisao(opcao)}
              aria-pressed={visao === opcao}
              className={cn(
                "flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-black uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
                visao === opcao ? cn(tema.bg, "text-white") : "text-slate-500 hover:text-white",
              )}
            >
              <Icon className="size-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
