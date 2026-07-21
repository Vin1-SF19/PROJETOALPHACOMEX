"use client";

import { CalendarDays, CalendarPlus, CalendarRange, ChevronLeft, ChevronRight, Grid3x3, LogOut, RefreshCw, Settings2, ShieldCheck, Users } from "lucide-react";
import Image from "next/image";

import { cn } from "@/lib/utils";
import type { TemaAlpha } from "@/lib/temas";

import { formatarTituloAno, formatarTituloDia, formatarTituloMes, formatarTituloSemana } from "./lib/datas";
import type { VisaoCalendario } from "./lib/datas";

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

export function HeaderCalendario({
  tema,
  visao,
  dataReferencia,
  emailUsuario,
  sincronizando,
  isAdmin,
  onMudarVisao,
  onHoje,
  onAnterior,
  onProximo,
  onNovoEvento,
  onAbrirConfiguracoes,
  onAbrirColegas,
  onAbrirPermissoes,
  onDesativar,
}: {
  tema: TemaAlpha;
  visao: VisaoCalendario;
  dataReferencia: Date;
  emailUsuario?: string;
  sincronizando: boolean;
  isAdmin: boolean;
  onMudarVisao: (visao: VisaoCalendario) => void;
  onHoje: () => void;
  onAnterior: () => void;
  onProximo: () => void;
  onNovoEvento: () => void;
  onAbrirConfiguracoes: () => void;
  onAbrirColegas: () => void;
  onAbrirPermissoes: () => void;
  onDesativar: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onHoje}
          className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-200 hover:bg-white/10 transition-colors"
        >
          Hoje
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onAnterior}
            aria-label="Período anterior"
            title="Período anterior"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onProximo}
            aria-label="Próximo período"
            title="Próximo período"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <h2 className="truncate text-base sm:text-lg font-black italic tracking-tight text-white capitalize">
          {tituloDaVisao(visao, dataReferencia)}
        </h2>
        {sincronizando && <RefreshCw className="w-3.5 h-3.5 text-slate-500 animate-spin shrink-0" aria-label="Sincronizando" />}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center rounded-xl border border-white/10 bg-white/5 p-0.5">
          {OPCOES_VISAO.map(({ visao: opcao, label, Icon }) => (
            <button
              key={opcao}
              type="button"
              onClick={() => onMudarVisao(opcao)}
              aria-pressed={visao === opcao}
              aria-label={`Visão de ${label.toLowerCase()}`}
              title={`Visão de ${label.toLowerCase()}`}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wide transition-colors",
                visao === opcao ? cn(tema.bg, "text-white") : "text-slate-400 hover:text-white",
              )}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onNovoEvento}
          className={cn(
            "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-black uppercase tracking-wide text-white transition-transform hover:scale-[1.03] active:scale-[0.98]",
            tema.bg,
          )}
        >
          <CalendarPlus className="w-4 h-4" /> Novo evento
        </button>

        <button
          type="button"
          onClick={onAbrirColegas}
          aria-label="Ver agenda de colegas"
          title="Ver agenda de colegas"
          className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          <Users className="w-4 h-4" />
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={onAbrirPermissoes}
            aria-label="Gerenciar permissão de compartilhamento de agenda"
            title="Gerenciar permissão de compartilhamento de agenda"
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            <ShieldCheck className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={onAbrirConfiguracoes}
          aria-label="Configurar calendários"
          title="Configurar calendários"
          className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 hover:bg-white/10 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          <Settings2 className="w-4 h-4" />
        </button>

        <div className="hidden sm:flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5">
          <Image src="/google.png" alt="" width={14} height={14} className="rounded-sm" />
          <span className="text-[11px] text-slate-400 truncate max-w-[10rem]">{emailUsuario}</span>
        </div>

        <button
          type="button"
          onClick={onDesativar}
          aria-label="Desativar Calendário Alpha"
          title="Desativar Calendário Alpha"
          className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
