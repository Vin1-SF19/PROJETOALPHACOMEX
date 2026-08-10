"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, GripVertical, Lock, Trash2 } from "lucide-react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEditorStore } from "../store/useEditorStore";
import { COMPONENTES_REGISTRY } from "../registry/componentes-registry";
import { registryFundoParaEstilo } from "../registry/registry-fundos";
import { useTimelineDrag } from "./useTimelineDrag";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import { normalizarConfigAnimacaoContainerAlpha } from "@/lib/apresentacoes/animacao-container-alpha";

const MAX_TEMPO = 5;
const PIXELS_POR_SEGUNDO = 80;
const LARGURA_REGUA = MAX_TEMPO * PIXELS_POR_SEGUNDO;

function resolverEntradaRegistry(componente: ComponenteSlide) {
  if (componente.tipo === "fundoAnimado") return registryFundoParaEstilo(componente.estilo, componente.preset);
  return COMPONENTES_REGISTRY[componente.tipo];
}

function BarraDeTempo({ componente, selecionado, onSelecionar }: { componente: ComponenteSlide; selecionado: boolean; onSelecionar: (event: React.MouseEvent) => void }) {
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

  const ehContainerAlpha = anim.tipo === "container-alpha";
  const configContainer = ehContainerAlpha ? normalizarConfigAnimacaoContainerAlpha(anim.containerAlpha) : null;
  const left = (ehContainerAlpha ? 0 : anim.delay) * PIXELS_POR_SEGUNDO;
  const duracao = configContainer
    ? configContainer.atrasoAbertura + configContainer.duracaoAbertura + configContainer.duracaoZoom
    : anim.duracao;
  const width = duracao * PIXELS_POR_SEGUNDO;

  return (
    <div className="relative h-6" style={{ width: LARGURA_REGUA }}>
      <div
        onClick={(event) => {
          event.stopPropagation();
          onSelecionar(event);
        }}
        onMouseDown={onMouseDownMover}
        className={`absolute top-0 flex h-6 cursor-grab items-center rounded px-1 text-[9px] font-bold text-white active:cursor-grabbing ${selecionado ? "bg-indigo-500" : "bg-indigo-500/50"}`}
        style={{ left, width: Math.max(width, 12) }}
      >
        <span className="truncate">{ehContainerAlpha ? "Container Alpha" : anim.tipo}</span>
        {!ehContainerAlpha && (
          <div
            onMouseDown={(event) => {
              event.stopPropagation();
              onMouseDownRedimensionar(event);
            }}
            className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize bg-white/30"
          />
        )}
      </div>
    </div>
  );
}

function LinhaCamada({ componente }: { componente: ComponenteSlide }) {
  const selecionado = useEditorStore((state) => state.componentesSelecionadosIds.includes(componente.id));
  const selecionarComponente = useEditorStore((state) => state.selecionarComponente);
  const removerComponente = useEditorStore((state) => state.removerComponente);
  const ehFundo = componente.tipo === "fundoAnimado";
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: componente.id, disabled: ehFundo });
  const Icone = resolverEntradaRegistry(componente).icone;

  function selecionar(event: React.MouseEvent) {
    selecionarComponente(componente.id, !ehFundo && (event.ctrlKey || event.metaKey));
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1 }}
      className="flex items-center gap-2"
    >
      <div className={`flex w-36 shrink-0 items-center rounded-lg border ${selecionado ? "border-cyan-400/50 bg-cyan-500/10" : "border-white/5 bg-slate-900/60"}`}>
        {ehFundo ? (
          <span
            aria-label="Fundo fixado na base das camadas"
            title="Fundo fixado na base das camadas"
            className="p-1.5 text-indigo-300"
          >
            <Lock size={12} aria-hidden="true" />
          </span>
        ) : (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Mover camada ${resolverEntradaRegistry(componente).label}`}
            title="Arraste para mudar a camada"
            className="cursor-grab touch-none p-1.5 text-slate-600 hover:text-white active:cursor-grabbing"
          >
            <GripVertical size={12} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={selecionar}
          className={`flex min-w-0 flex-1 items-center gap-1.5 py-1 text-[10px] ${selecionado ? "text-white" : "text-slate-400"}`}
        >
          <Icone size={11} aria-hidden="true" className="shrink-0" />
          <span className="truncate">{resolverEntradaRegistry(componente).label}</span>
        </button>
        <button
          type="button"
          onClick={() => removerComponente(componente.id)}
          aria-label={`Excluir ${resolverEntradaRegistry(componente).label} da timeline`}
          title="Excluir elemento"
          className="cursor-pointer p-1.5 text-slate-600 hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 size={11} aria-hidden="true" />
        </button>
      </div>
      <BarraDeTempo componente={componente} selecionado={selecionado} onSelecionar={selecionar} />
    </div>
  );
}

/** Timeline de elementos: tempo da animação + ordem real de camadas do slide. */
export function TimelineReal() {
  const [aberto, setAberto] = useState(true);
  const componentes = useEditorStore((state) => state.componentes);
  const reordenarCamadas = useEditorStore((state) => state.reordenarCamadas);
  const camadas = [...componentes].sort((a, b) => b.zIndex - a.zIndex);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const camadaAtiva = camadas.find((componente) => componente.id === active.id);
    const camadaAlvo = camadas.find((componente) => componente.id === over.id);
    if (camadaAtiva?.tipo === "fundoAnimado" || camadaAlvo?.tipo === "fundoAnimado") return;
    const oldIndex = camadas.findIndex((componente) => componente.id === active.id);
    const newIndex = camadas.findIndex((componente) => componente.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    reordenarCamadas(arrayMove(camadas, oldIndex, newIndex).map((componente) => componente.id));
  }

  return (
    <div className="shrink-0 border-t border-white/5 bg-slate-950/80">
      <button
        onClick={() => setAberto((valor) => !valor)}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white"
        aria-expanded={aberto}
      >
        Camadas e animações ({camadas.length})
        {aberto ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronUp size={12} aria-hidden="true" />}
      </button>

      {aberto && (
        <div className="max-h-48 overflow-auto px-4 pb-3">
          {camadas.length === 0 ? (
            <p className="text-xs text-slate-600">Nenhum componente neste slide ainda.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={camadas.map((componente) => componente.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-1.5">
                  <div className="flex gap-2">
                    <div className="w-36 shrink-0 px-2 text-[9px] text-slate-600">Topo ↑ / Base ↓</div>
                    <div className="relative h-4 border-b border-white/10" style={{ width: LARGURA_REGUA }}>
                      {Array.from({ length: MAX_TEMPO + 1 }).map((_, index) => (
                        <span key={index} className="absolute top-0 text-[9px] text-slate-600" style={{ left: index * PIXELS_POR_SEGUNDO }}>
                          {index}s
                        </span>
                      ))}
                    </div>
                  </div>
                  {camadas.map((componente) => <LinhaCamada key={componente.id} componente={componente} />)}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
    </div>
  );
}
