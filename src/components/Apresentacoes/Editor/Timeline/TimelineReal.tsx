"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useEditorStore } from "../store/useEditorStore";
import { COMPONENTES_REGISTRY } from "../registry/componentes-registry";
import { useTimelineDrag } from "./useTimelineDrag";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";

const MAX_TEMPO = 5;
const PIXELS_POR_SEGUNDO = 80;
const LARGURA_REGUA = MAX_TEMPO * PIXELS_POR_SEGUNDO;

function BarraDeTempo({ componente, selecionado, onSelecionar }: { componente: ComponenteSlide; selecionado: boolean; onSelecionar: () => void }) {
  const anim = componente.animacao?.entrada;
  const { onMouseDownMover, onMouseDownRedimensionar } = useTimelineDrag(componente);

  if (!anim) {
    return (
      <button
        onClick={onSelecionar}
        className="h-6 w-24 shrink-0 cursor-pointer rounded border border-dashed border-white/10 bg-slate-900/40 text-[10px] text-slate-600 hover:border-white/20"
        aria-label={`${componente.tipo} sem animação — clique para configurar`}
      >
        sem animação
      </button>
    );
  }

  const left = anim.delay * PIXELS_POR_SEGUNDO;
  const width = anim.duracao * PIXELS_POR_SEGUNDO;

  return (
    <div className="relative h-6" style={{ width: LARGURA_REGUA }}>
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelecionar();
        }}
        onMouseDown={onMouseDownMover}
        className={`absolute top-0 flex h-6 cursor-grab items-center rounded px-1 text-[9px] font-bold text-white active:cursor-grabbing ${
          selecionado ? "bg-indigo-500" : "bg-indigo-500/50"
        }`}
        style={{ left, width: Math.max(width, 12) }}
      >
        <span className="truncate">{anim.tipo}</span>
        <div
          onMouseDown={(e) => {
            e.stopPropagation();
            onMouseDownRedimensionar(e);
          }}
          className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize bg-white/30"
        />
      </div>
    </div>
  );
}

/** Timeline real (Onda 3): régua de tempo + barras de delay/duração da animação de entrada, arrastáveis. */
export function TimelineReal() {
  const [aberto, setAberto] = useState(true);
  const componentes = useEditorStore((s) => s.componentes);
  const selecionadoId = useEditorStore((s) => s.componenteSelecionadoId);
  const selecionarComponente = useEditorStore((s) => s.selecionarComponente);

  const camadas = [...componentes].sort((a, b) => b.zIndex - a.zIndex);

  return (
    <div className="shrink-0 border-t border-white/5 bg-slate-950/80">
      <button
        onClick={() => setAberto((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white"
        aria-expanded={aberto}
      >
        Timeline ({camadas.length})
        {aberto ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronUp size={12} aria-hidden="true" />}
      </button>

      {aberto && (
        <div className="max-h-48 overflow-auto px-4 pb-3">
          {camadas.length === 0 ? (
            <p className="text-xs text-slate-600">Nenhum componente neste slide ainda.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {/* Régua de tempo */}
              <div className="flex gap-2">
                <div className="w-28 shrink-0" />
                <div className="relative h-4 border-b border-white/10" style={{ width: LARGURA_REGUA }}>
                  {Array.from({ length: MAX_TEMPO + 1 }).map((_, i) => (
                    <span
                      key={i}
                      className="absolute top-0 text-[9px] text-slate-600"
                      style={{ left: i * PIXELS_POR_SEGUNDO }}
                    >
                      {i}s
                    </span>
                  ))}
                </div>
              </div>

              {camadas.map((c) => {
                const Icone = COMPONENTES_REGISTRY[c.tipo].icone;
                return (
                  <div key={c.id} className="flex items-center gap-2">
                    <button
                      onClick={() => selecionarComponente(c.id)}
                      className={`flex w-28 shrink-0 items-center gap-1.5 truncate rounded-lg border px-2 py-1 text-[10px] transition-colors ${
                        selecionadoId === c.id
                          ? "border-indigo-500/40 bg-indigo-500/10 text-white"
                          : "border-white/5 bg-slate-900/60 text-slate-400 hover:border-white/10"
                      }`}
                    >
                      <Icone size={11} aria-hidden="true" className="shrink-0" />
                      <span className="truncate">{COMPONENTES_REGISTRY[c.tipo].label}</span>
                    </button>
                    <BarraDeTempo componente={c} selecionado={selecionadoId === c.id} onSelecionar={() => selecionarComponente(c.id)} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
