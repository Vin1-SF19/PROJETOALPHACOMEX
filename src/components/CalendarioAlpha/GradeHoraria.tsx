"use client";

import { useEffect, useRef } from "react";

import type { TemaAlpha } from "@/lib/temas";
import { cn } from "@/lib/utils";

import { DetalhePopover } from "./DetalhePopover";
import { formatarDiaSemanaCurto, formatarHora, mesmodia } from "./lib/datas";
import { calcularPosicoesEventosDoDia, eventosDiaInteiroDoDia } from "./lib/layout-eventos";
import { COR_CALENDARIO_PADRAO, type EventoExibicao } from "./lib/tipos";

const ALTURA_HORA_PX = 64;
const HORAS = Array.from({ length: 24 }, (_, i) => i);

/** Grade horária compartilhada — 1 coluna (Dia) ou 7 colunas (Semana). */
export function GradeHoraria({
  dias,
  eventos,
  tema,
  onEditarEvento,
  onEventoCancelado,
  onSelecionarHorario,
}: {
  dias: Date[];
  eventos: EventoExibicao[];
  tema: TemaAlpha;
  onEditarEvento: (evento: EventoExibicao) => void;
  onEventoCancelado: () => void;
  onSelecionarHorario: (data: Date) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hoje = new Date();

  useEffect(() => {
    // Abre a grade já rolada para perto da hora atual — sem isso o usuário cai no topo (meia-noite).
    if (containerRef.current) {
      const agora = new Date();
      const offsetPx = ((agora.getHours() * 60 + agora.getMinutes()) / 60) * ALTURA_HORA_PX;
      containerRef.current.scrollTop = Math.max(0, offsetPx - ALTURA_HORA_PX * 2);
    }
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[1.75rem] border border-white/5 bg-white/[0.02]">
      <div
        className="grid shrink-0 border-b border-white/5"
        style={{ gridTemplateColumns: `4rem repeat(${dias.length}, 1fr)` }}
      >
        <div />
        {dias.map((dia) => {
          const ehHoje = mesmodia(dia, hoje);
          return (
            <div key={dia.toISOString()} className="px-2 py-2.5 text-center border-l border-white/5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {formatarDiaSemanaCurto(dia)}
              </p>
              <p className={cn("mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-slate-200", ehHoje && "bg-white text-slate-950")}>
                {dia.getDate()}
              </p>
            </div>
          );
        })}
      </div>

      {dias.some((dia) => eventosDiaInteiroDoDia(dia, eventos).length > 0) && (
        <div className="grid max-h-28 shrink-0 overflow-y-auto border-b border-white/5" style={{ gridTemplateColumns: `4rem repeat(${dias.length}, 1fr)` }}>
          <div className="flex items-center justify-end pr-2 text-[9px] font-bold uppercase text-slate-600">Dia todo</div>
          {dias.map((dia) => (
            <div key={dia.toISOString()} className="border-l border-white/5 p-1 space-y-1 min-h-[2rem]">
              {eventosDiaInteiroDoDia(dia, eventos).map((evento) => (
                <DetalhePopover key={evento.id} evento={evento} tema={tema} onEditar={onEditarEvento} onCancelado={onEventoCancelado}>
                  <button
                    type="button"
                    className="block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[10px] font-semibold text-white/90 hover:brightness-110"
                    style={{ backgroundColor: `${evento.calendarioCorHex ?? COR_CALENDARIO_PADRAO}88` }}
                  >
                    {evento.titulo || "(sem título)"}
                  </button>
                </DetalhePopover>
              ))}
            </div>
          ))}
        </div>
      )}

      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="grid" style={{ gridTemplateColumns: `4rem repeat(${dias.length}, 1fr)` }}>
          <div>
            {HORAS.map((hora) => (
              <div key={hora} style={{ height: ALTURA_HORA_PX }} className="pr-2 text-right text-[10px] text-slate-600 -translate-y-2">
                {hora > 0 && `${String(hora).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>

          {dias.map((dia) => {
            const posicoes = calcularPosicoesEventosDoDia(dia, eventos);
            const ehHoje = mesmodia(dia, hoje);
            return (
              <div
                key={dia.toISOString()}
                className="relative border-l border-white/5"
                style={{ height: ALTURA_HORA_PX * 24 }}
              >
                {HORAS.map((hora) => (
                  <button
                    key={hora}
                    type="button"
                    onClick={() => {
                      const dataHorario = new Date(dia);
                      dataHorario.setHours(hora, 0, 0, 0);
                      onSelecionarHorario(dataHorario);
                    }}
                    aria-label={`Novo evento às ${String(hora).padStart(2, "0")}:00`}
                    className="absolute inset-x-0 w-full border-b border-white/[0.04] hover:bg-white/[0.03] focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/20"
                    style={{ top: hora * ALTURA_HORA_PX, height: ALTURA_HORA_PX }}
                  />
                ))}

                {ehHoje && (
                  <div
                    className="absolute inset-x-0 z-10 h-px bg-rose-500"
                    style={{ top: ((hoje.getHours() * 60 + hoje.getMinutes()) / 60) * ALTURA_HORA_PX }}
                  >
                    <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-rose-500" />
                  </div>
                )}

                {posicoes.map(({ evento, topoPercentual, alturaPercentual, coluna, totalColunas }) => (
                  <DetalhePopover key={evento.id} evento={evento} tema={tema} onEditar={onEditarEvento} onCancelado={onEventoCancelado}>
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute z-20 overflow-hidden rounded-lg px-1.5 py-1 text-left text-[10px] font-semibold text-white/95 shadow-md hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                      style={{
                        top: `${topoPercentual}%`,
                        height: `${alturaPercentual}%`,
                        left: `${(coluna / totalColunas) * 100}%`,
                        width: `${100 / totalColunas}%`,
                        backgroundColor: `${evento.calendarioCorHex ?? COR_CALENDARIO_PADRAO}cc`,
                      }}
                      title={evento.titulo ?? "(sem título)"}
                    >
                      <span className="block truncate">{evento.titulo || "(sem título)"}</span>
                      {evento.inicioEm && <span className="block truncate opacity-80">{formatarHora(new Date(evento.inicioEm))}</span>}
                    </button>
                  </DetalhePopover>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
