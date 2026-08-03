"use client";

import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CriarSlide, ExcluirSlide, DuplicarSlide, ObterSlide, ListarSlides, ReordenarSlides } from "@/actions/slides";
import { useEditorStore } from "../store/useEditorStore";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import { CANVAS_PADRAO, obterCanvasSeguro, type CanvasConfig } from "@/lib/apresentacoes/canvas";
import { obterEntradaApresentacaoSegura } from "@/lib/apresentacoes/entrada-apresentacao";

interface DadosSlidePersistidos {
  componentes: ComponenteSlide[];
  canvas?: CanvasConfig;
  entradaApresentacao?: unknown;
}

function ItemSlide({ id, ordem, nome, ativo, podeExcluir, onSelecionar, onDuplicar, onExcluir }: {
  id: string;
  ordem: number;
  nome: string | null;
  ativo: boolean;
  podeExcluir: boolean;
  onSelecionar: () => void;
  onDuplicar: () => void;
  onExcluir: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelecionar}
      className={`group flex cursor-pointer items-center gap-2 rounded-xl border p-2 text-xs transition-colors ${
        ativo ? "border-indigo-500/40 bg-indigo-500/10 text-white" : "border-white/5 bg-slate-900/40 text-slate-400 hover:border-white/10"
      }`}
    >
      <span {...attributes} {...listeners} className="cursor-grab select-none px-1 text-slate-600">
        {ordem + 1}
      </span>
      <span className="flex-1 truncate">{nome || `Slide ${ordem + 1}`}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onDuplicar(); }}
        aria-label="Duplicar slide"
        className="cursor-pointer rounded p-1 text-slate-500 opacity-0 hover:text-white hover:bg-white/10 group-hover:opacity-100"
      >
        <Copy size={12} aria-hidden="true" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onExcluir(); }}
        disabled={!podeExcluir}
        aria-label={podeExcluir ? "Excluir slide" : "A apresentação precisa ter pelo menos 1 slide"}
        title={podeExcluir ? undefined : "A apresentação precisa ter pelo menos 1 slide"}
        className="cursor-pointer rounded p-1 text-slate-500 opacity-0 hover:text-red-400 hover:bg-red-500/10 group-hover:opacity-100 disabled:opacity-0 disabled:cursor-not-allowed"
      >
        <Trash2 size={12} aria-hidden="true" />
      </button>
    </div>
  );
}

export function SidebarSlides() {
  const apresentacaoId = useEditorStore((s) => s.apresentacaoId);
  const slides = useEditorStore((s) => s.slides);
  const slideAtivoId = useEditorStore((s) => s.slideAtivoId);
  const setSlides = useEditorStore((s) => s.setSlides);
  const carregarSlide = useEditorStore((s) => s.carregarSlide);
  const [processando, setProcessando] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function handleSelecionar(slideId: string) {
    if (slideId === slideAtivoId) return;
    const res = await ObterSlide(slideId);
    if (res.success && res.data) {
      const dadosJson = res.data.dadosJson as DadosSlidePersistidos | null;
      carregarSlide(
        slideId,
        dadosJson?.componentes ?? [],
        obterCanvasSeguro(dadosJson?.canvas),
        obterEntradaApresentacaoSegura(dadosJson?.entradaApresentacao),
      );
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Erro ao abrir slide.");
    }
  }

  async function handleAdicionar() {
    if (!apresentacaoId || processando) return;
    setProcessando(true);
    try {
      const res = await CriarSlide(apresentacaoId);
      if (res.success && res.data) {
        setSlides([...slides, {
          id: res.data.id,
          ordem: res.data.ordem,
          nome: res.data.nome,
          componentes: [],
          canvas: CANVAS_PADRAO,
          entradaApresentacao: null,
        }]);
        carregarSlide(res.data.id, [], CANVAS_PADRAO, null);
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Erro ao criar slide.");
      }
    } finally {
      setProcessando(false);
    }
  }

  async function handleDuplicar(slideId: string) {
    if (processando || !apresentacaoId) return;
    setProcessando(true);
    try {
      const res = await DuplicarSlide(slideId);
      if (res.success) {
        toast.success("Slide duplicado.");
        const listaAtualizada = await ListarSlides(apresentacaoId);
        if (listaAtualizada.success) {
          setSlides(listaAtualizada.data.map((s) => ({
            id: s.id,
            ordem: s.ordem,
            nome: s.nome,
            componentes: (s.dadosJson as { componentes: ComponenteSlide[] } | null)?.componentes ?? [],
            canvas: obterCanvasSeguro((s.dadosJson as DadosSlidePersistidos | null)?.canvas),
            entradaApresentacao: obterEntradaApresentacaoSegura(
              (s.dadosJson as DadosSlidePersistidos | null)?.entradaApresentacao,
            ),
          })));
        }
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Erro ao duplicar slide.");
      }
    } finally {
      setProcessando(false);
    }
  }

  async function handleExcluir(slideId: string) {
    if (processando) return;
    setProcessando(true);
    try {
      const res = await ExcluirSlide(slideId);
      if (res.success) {
        const restantes = slides.filter((s) => s.id !== slideId);
        setSlides(restantes);
        if (slideAtivoId === slideId && restantes[0]) {
          await handleSelecionar(restantes[0].id);
        }
        toast.success("Slide excluído.");
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Erro ao excluir slide.");
      }
    } finally {
      setProcessando(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !apresentacaoId) return;

    const oldIndex = slides.findIndex((s) => s.id === active.id);
    const newIndex = slides.findIndex((s) => s.id === over.id);
    const reordenados = arrayMove(slides, oldIndex, newIndex).map((s, i) => ({ ...s, ordem: i }));
    setSlides(reordenados);

    const res = await ReordenarSlides({ apresentacaoId, ordemIds: reordenados.map((s) => s.id) });
    if (!res.success) toast.error("Erro ao salvar a nova ordem dos slides.");
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Slides</h3>
        <button
          onClick={handleAdicionar}
          disabled={processando}
          aria-label="Adicionar slide"
          className="cursor-pointer rounded-lg p-1 text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-40"
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {slides.map((s) => (
              <ItemSlide
                key={s.id}
                id={s.id}
                ordem={s.ordem}
                nome={s.nome}
                ativo={s.id === slideAtivoId}
                podeExcluir={slides.length > 1}
                onSelecionar={() => handleSelecionar(s.id)}
                onDuplicar={() => handleDuplicar(s.id)}
                onExcluir={() => handleExcluir(s.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
