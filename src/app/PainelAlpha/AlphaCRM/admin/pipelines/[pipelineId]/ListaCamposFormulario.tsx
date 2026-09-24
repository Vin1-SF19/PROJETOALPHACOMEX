"use client";

import { useState } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical, Layers3, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { itensFormulario } from "@/lib/bpm/ordem-formulario";
import type { ComponenteFormulario, SecaoFormulario } from "./FormularioEtapaWorkspace";

interface Metadados { nome: string; tipo: string; obrigatorio: boolean; rotulo: string }
interface ListaProps {
  secoes: SecaoFormulario[];
  bloqueado: boolean;
  metadados: (componente: ComponenteFormulario) => Metadados;
  onMover: (origem: string, destino: string) => boolean;
  onRotulo: (secao: number, indice: number, rotulo: string) => void;
  onRemover: (secao: number, indice: number) => void;
  onSelecionar?: (componente: ComponenteFormulario) => void;
}
interface ItemProps {
  id: string; meta: Metadados; bloqueado: boolean; primeiro: boolean; ultimo: boolean;
  mover: (direcao: number) => void; rotulo: (valor: string) => void; remover: () => void;
  selecionar?: () => void;
}
function ItemCampo({ id, meta, bloqueado, primeiro, ultimo, mover, rotulo, remover, selecionar }: ItemProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging, isOver } = useSortable({ id, disabled: bloqueado });
  const botao = "inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:opacity-40";
  return <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
    <Card className={cn("group min-h-20 flex-row flex-wrap items-start gap-2 rounded-2xl border-white/10 bg-[linear-gradient(120deg,rgba(255,255,255,.055),rgba(255,255,255,.018))] px-3 py-3 shadow-[0_10px_30px_rgba(0,0,0,.12)] transition-all hover:border-cyan-300/30 hover:bg-cyan-300/[.055]", isDragging && "relative z-10 opacity-90 shadow-lg ring-2 ring-cyan-300", isOver && !isDragging && "ring-1 ring-cyan-300/50")}>
      <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} disabled={bloqueado} aria-label={`Arrastar ${meta.nome}`} className={cn(botao, "w-10 shrink-0 touch-none cursor-grab active:cursor-grabbing disabled:cursor-not-allowed")}><GripVertical size={18} aria-hidden /></button>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/10 text-cyan-200"><Layers3 size={16} aria-hidden /></div>
      <div className="min-w-0 flex-1 basis-36">
        <button type="button" onClick={selecionar} disabled={bloqueado} className="block max-w-full truncate text-left text-sm font-semibold text-white hover:text-cyan-200 focus-visible:outline-2 focus-visible:outline-cyan-400 disabled:opacity-40">{meta.nome}</button>
        <div className="mt-1 flex flex-wrap items-center gap-1.5"><span className="text-[11px] text-slate-400">{meta.tipo}</span><Badge variant={meta.obrigatorio ? "default" : "secondary"} className="text-[10px]">{meta.obrigatorio ? "Obrigatório" : "Opcional"}</Badge></div>
        <label className="mt-3 block text-[10px] font-semibold text-slate-400">Nome exibido no card
          <input aria-label={`Rótulo de ${meta.nome}`} disabled={bloqueado} value={meta.rotulo} placeholder={meta.nome} maxLength={120} onChange={(event) => rotulo(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 text-xs text-white placeholder:text-slate-500 focus-visible:outline-2 focus-visible:outline-cyan-300" />
        </label>
      </div>
      {bloqueado && <Badge variant="outline">Somente leitura</Badge>}
      <div className="ml-auto flex items-center rounded-xl border border-white/[.06] bg-slate-950/40">
        <button type="button" aria-label={`Mover ${meta.nome} para cima`} disabled={bloqueado || primeiro} className={botao} onClick={() => mover(-1)}><ChevronUp size={18} aria-hidden /></button>
        <button type="button" aria-label={`Mover ${meta.nome} para baixo`} disabled={bloqueado || ultimo} className={botao} onClick={() => mover(1)}><ChevronDown size={18} aria-hidden /></button>
        <button type="button" aria-label={`Remover ${meta.nome} da apresentação`} disabled={bloqueado} className={cn(botao, "text-destructive")} onClick={remover}><Trash2 size={18} aria-hidden /></button>
      </div>
    </Card>
  </li>;
}

export function ListaCamposFormulario({ secoes, bloqueado, metadados, onMover, onRotulo, onRemover, onSelecionar }: ListaProps) {
  const itens = itensFormulario(secoes);
  const [anuncio, setAnuncio] = useState("");
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  function mover(origem: string, destino: string) {
    if (bloqueado || origem === destino) return;
    if (onMover(origem, destino)) setAnuncio(`${metadados(itens.find((item) => item.id === origem)!.componente).nome} movido para posição ${itens.findIndex((item) => item.id === destino) + 1} de ${itens.length}`);
  }
  const nome = (id: string | number) => { const item = itens.find((item) => item.id === id); return item ? metadados(item.componente).nome : "Campo"; };
  return <div className="mx-auto w-full max-w-3xl">
    <p role="status" aria-live="polite" className="sr-only">{anuncio}</p>
    {!itens.length && <p className="rounded-2xl border border-dashed border-cyan-300/20 bg-cyan-300/[.025] px-5 py-10 text-center text-sm text-slate-400">Esta seção ainda está vazia. Escolha campos ou blocos operacionais no catálogo.</p>}
    <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={({ active, over }) => { if (over) mover(String(active.id), String(over.id)); }} accessibility={{
      screenReaderInstructions: { draggable: "Para reordenar um campo, pressione espaço, use as setas para mover e pressione espaço novamente para soltar. Escape cancela." },
      announcements: {
        onDragStart: ({ active }) => `${nome(active.id)} selecionado para mover.`,
        onDragOver: ({ active, over }) => over ? `${nome(active.id)}, posição ${itens.findIndex((item) => item.id === over.id) + 1} de ${itens.length}.` : "Fora da lista.",
        onDragEnd: () => "Arraste encerrado.",
        onDragCancel: () => "Movimento cancelado. Ordem anterior preservada.",
      },
    }}>
      <SortableContext items={itens.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <ul aria-label="Campos do formulário" className="space-y-3">
          {itens.map((item, i) => <ItemCampo key={item.id} id={item.id} meta={metadados(item.componente)} bloqueado={bloqueado} primeiro={i === 0} ultimo={i === itens.length - 1} mover={(direcao) => mover(item.id, itens[i + direcao].id)} rotulo={(valor) => onRotulo(item.secao, item.indice, valor)} remover={() => onRemover(item.secao, item.indice)} selecionar={() => onSelecionar?.(item.componente)} />)}
        </ul>
      </SortableContext>
    </DndContext>
  </div>;
}
