"use client";

import { useState } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical, Trash2 } from "lucide-react";
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
}
interface ItemProps {
  id: string; meta: Metadados; bloqueado: boolean; primeiro: boolean; ultimo: boolean;
  mover: (direcao: number) => void; rotulo: (valor: string) => void; remover: () => void;
}
function ItemCampo({ id, meta, bloqueado, primeiro, ultimo, mover, rotulo, remover }: ItemProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging, isOver } = useSortable({ id, disabled: bloqueado });
  const botao = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40";
  return <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
    <Card className={cn("min-h-14 flex-row flex-wrap items-center gap-2 px-2 py-3 hover:border-primary/30", isDragging && "relative z-10 opacity-90 shadow-lg ring-2 ring-ring", isOver && !isDragging && "ring-1 ring-ring/50")}>
      <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} disabled={bloqueado} aria-label={`Arrastar ${meta.nome}`} className={cn(botao, "w-14 shrink-0 touch-none cursor-grab active:cursor-grabbing sm:w-12 disabled:cursor-not-allowed")}><GripVertical size={18} aria-hidden /></button>
      <div className="min-w-0 flex-1 basis-32">
        <p className="truncate text-sm font-medium text-foreground">{meta.nome}</p>
        <p className="text-xs text-muted-foreground">{meta.tipo}</p>
        <Badge variant={meta.obrigatorio ? "default" : "secondary"}>{meta.obrigatorio ? "Obrigatório" : "Opcional"}</Badge>
        <input aria-label={`Rótulo de ${meta.nome}`} disabled={bloqueado} value={meta.rotulo} placeholder={meta.nome} maxLength={120} onChange={(event) => rotulo(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground" />
      </div>
      {bloqueado && <Badge variant="outline">Somente leitura</Badge>}
      <div className="ml-auto flex items-center">
        <button type="button" aria-label={`Mover ${meta.nome} para cima`} disabled={bloqueado || primeiro} className={botao} onClick={() => mover(-1)}><ChevronUp size={18} aria-hidden /></button>
        <button type="button" aria-label={`Mover ${meta.nome} para baixo`} disabled={bloqueado || ultimo} className={botao} onClick={() => mover(1)}><ChevronDown size={18} aria-hidden /></button>
        <button type="button" aria-label={`Remover ${meta.nome} da apresentação`} disabled={bloqueado} className={cn(botao, "text-destructive")} onClick={remover}><Trash2 size={18} aria-hidden /></button>
      </div>
    </Card>
  </li>;
}

export function ListaCamposFormulario({ secoes, bloqueado, metadados, onMover, onRotulo, onRemover }: ListaProps) {
  const itens = itensFormulario(secoes);
  const [anuncio, setAnuncio] = useState("");
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  function mover(origem: string, destino: string) {
    if (bloqueado || origem === destino) return;
    if (onMover(origem, destino)) setAnuncio(`${metadados(itens.find((item) => item.id === origem)!.componente).nome} movido para posição ${itens.findIndex((item) => item.id === destino) + 1} de ${itens.length}`);
  }
  const nome = (id: string | number) => { const item = itens.find((item) => item.id === id); return item ? metadados(item.componente).nome : "Campo"; };
  return <div className="max-w-2xl">
    <p role="status" aria-live="polite" className="sr-only">{anuncio}</p>
    {!itens.length && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum campo nesta etapa. Adicione campos para compor o formulário.</p>}
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
        <ul aria-label="Campos do formulário" className="space-y-2">
          {itens.map((item, i) => <ItemCampo key={item.id} id={item.id} meta={metadados(item.componente)} bloqueado={bloqueado} primeiro={i === 0} ultimo={i === itens.length - 1} mover={(direcao) => mover(item.id, itens[i + direcao].id)} rotulo={(valor) => onRotulo(item.secao, item.indice, valor)} remover={() => onRemover(item.secao, item.indice)} />)}
        </ul>
      </SortableContext>
    </DndContext>
  </div>;
}
