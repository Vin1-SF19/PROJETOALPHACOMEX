"use client";

import type { TemaAlpha } from "@/lib/temas";
import { cn } from "@/lib/utils";

interface MiniCalendarioAgendaProps {
  dataReferencia: Date;
  tema: TemaAlpha;
  onSelecionarDia: (data: Date) => void;
}

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

function mesmaData(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function MiniCalendarioAgenda({
  dataReferencia,
  tema,
  onSelecionarDia,
}: MiniCalendarioAgendaProps) {
  const ano = dataReferencia.getFullYear();
  const mes = dataReferencia.getMonth();
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const hoje = new Date();
  const celulas = Array.from({ length: 42 }, (_, indice) => {
    const numero = indice - primeiroDia + 1;
    return numero >= 1 && numero <= diasNoMes ? numero : null;
  });

  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.025] p-2.5 xl:p-3">
      <p className="mb-1.5 text-[11px] font-bold capitalize text-slate-200 xl:mb-2 xl:text-xs">
        {new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(dataReferencia)}
      </p>
      <div className="grid grid-cols-7 text-center">
        {DIAS_SEMANA.map((dia, indice) => (
          <span key={`${dia}-${indice}`} className="py-1 text-[9px] font-bold text-slate-600">
            {dia}
          </span>
        ))}
        {celulas.map((numero, indice) => {
          if (!numero) return <span key={`vazio-${indice}`} aria-hidden="true" />;
          const data = new Date(ano, mes, numero);
          const selecionada = mesmaData(data, dataReferencia);
          const atual = mesmaData(data, hoje);
          return (
            <button
              key={numero}
              type="button"
              onClick={() => onSelecionarDia(data)}
              aria-label={new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(data)}
              aria-current={atual ? "date" : undefined}
              className={cn(
                "mx-auto flex size-7 items-center justify-center rounded-lg text-[10px] text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 lg:size-6 xl:size-7",
                selecionada && cn(tema.bg, "font-black text-white"),
                atual && !selecionada && cn("font-bold ring-1", tema.border, tema.text),
              )}
            >
              {numero}
            </button>
          );
        })}
      </div>
    </div>
  );
}
