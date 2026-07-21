"use client";

import { cn } from "@/lib/utils";
import type { TemaAlpha } from "@/lib/temas";

import { agruparPorDia, diasDoGridMes, formatarMesCurto, mesesDoAno, mesmodia } from "./lib/datas";
import { COR_CALENDARIO_PADRAO, type EventoExibicao } from "./lib/tipos";

const DIAS_SEMANA_INICIAIS = ["D", "S", "T", "Q", "Q", "S", "S"];

function MiniMes({
  mesReferencia,
  eventosPorDia,
  tema,
  onSelecionarMes,
  onSelecionarDia,
}: {
  mesReferencia: Date;
  eventosPorDia: Map<string, EventoExibicao[]>;
  tema: TemaAlpha;
  onSelecionarMes: (data: Date) => void;
  onSelecionarDia: (data: Date) => void;
}) {
  const dias = diasDoGridMes(mesReferencia);
  const hoje = new Date();

  return (
    <div className="rounded-[1.75rem] border border-white/5 bg-white/[0.02] p-4">
      <button
        type="button"
        onClick={() => onSelecionarMes(mesReferencia)}
        className={cn("mb-3 text-sm font-black uppercase italic tracking-tight text-white hover:underline underline-offset-4", tema.text)}
      >
        {formatarMesCurto(mesReferencia)}
      </button>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {DIAS_SEMANA_INICIAIS.map((letra, i) => (
          <span key={i} className="text-[9px] font-bold text-slate-600">
            {letra}
          </span>
        ))}
        {dias.map((dia) => {
          const foraDoMes = dia.getMonth() !== mesReferencia.getMonth();
          const chave = dia.toISOString().slice(0, 10);
          const temEventos = (eventosPorDia.get(chave)?.length ?? 0) > 0;
          const ehHoje = mesmodia(dia, hoje);

          return (
            <button
              key={chave}
              type="button"
              onClick={() => onSelecionarDia(dia)}
              disabled={foraDoMes}
              className={cn(
                "relative flex h-6 w-6 items-center justify-center justify-self-center rounded-full text-[10px] font-semibold transition-colors",
                foraDoMes ? "text-slate-700 cursor-default" : "text-slate-300 hover:bg-white/10",
                ehHoje && cn(tema.bg, "text-white"),
              )}
            >
              {dia.getDate()}
              {temEventos && !ehHoje && (
                <span
                  className="absolute bottom-0.5 h-1 w-1 rounded-full"
                  style={{ backgroundColor: COR_CALENDARIO_PADRAO }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function VisaoAno({
  dataReferencia,
  eventos,
  tema,
  onSelecionarMes,
  onSelecionarDia,
}: {
  dataReferencia: Date;
  eventos: EventoExibicao[];
  tema: TemaAlpha;
  onSelecionarMes: (data: Date) => void;
  onSelecionarDia: (data: Date) => void;
}) {
  const eventosPorDia = agruparPorDia(eventos);
  const meses = mesesDoAno(dataReferencia);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {meses.map((mes) => (
        <MiniMes
          key={mes.toISOString()}
          mesReferencia={mes}
          eventosPorDia={eventosPorDia}
          tema={tema}
          onSelecionarMes={onSelecionarMes}
          onSelecionarDia={onSelecionarDia}
        />
      ))}
    </div>
  );
}
