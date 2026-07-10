"use client";

import { useEffect, useRef, useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { AtualizarSlide } from "@/actions/slides";
import { useEditorStore, type SlideResumo } from "./store/useEditorStore";
import { COMPONENTES_REGISTRY, type TipoComponente } from "./registry/componentes-registry";
import { BarraSuperiorEditor } from "./BarraSuperior/BarraSuperiorEditor";
import { SidebarComponentes } from "./SidebarEsquerda/SidebarComponentes";
import { SidebarSlides } from "./SidebarEsquerda/SidebarSlides";
import { CanvasArea, CANVAS_DIMENSOES } from "./Canvas/CanvasArea";
import { PainelPropriedades } from "./PainelDireito/PainelPropriedades";
import { TimelineReal } from "./Timeline/TimelineReal";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";

const AUTOSAVE_DEBOUNCE_MS = 1500;

export interface TemaResumo {
  id: string;
  nome: string;
  corPrimaria: string;
  corSecundaria: string;
  corAccent: string;
}

interface ApresentacaoEditorProps {
  apresentacaoId: string;
  titulo: string;
  slidesIniciais: SlideResumo[];
  slideAtivoIdInicial: string;
  componentesIniciais: ComponenteSlide[];
  temaInicial: TemaResumo | null;
}

export function ApresentacaoEditor({
  apresentacaoId,
  titulo,
  slidesIniciais,
  slideAtivoIdInicial,
  componentesIniciais,
  temaInicial,
}: ApresentacaoEditorProps) {
  const [tema, setTema] = useState<TemaResumo | null>(temaInicial);
  const inicializar = useEditorStore((s) => s.inicializar);
  const carregarSlide = useEditorStore((s) => s.carregarSlide);
  const componentes = useEditorStore((s) => s.componentes);
  const slideAtivoId = useEditorStore((s) => s.slideAtivoId);
  const isDirty = useEditorStore((s) => s.isDirty);
  const marcarSalvo = useEditorStore((s) => s.marcarSalvo);
  const setSaving = useEditorStore((s) => s.setSaving);
  const adicionarComponente = useEditorStore((s) => s.adicionarComponente);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inicializadoRef = useRef(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (inicializadoRef.current) return;
    inicializadoRef.current = true;
    inicializar(apresentacaoId, slidesIniciais);
    carregarSlide(slideAtivoIdInicial, componentesIniciais);
  }, [apresentacaoId, slidesIniciais, slideAtivoIdInicial, componentesIniciais, inicializar, carregarSlide]);

  useEffect(() => {
    if (!isDirty || !slideAtivoId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaving(true);
      const res = await AtualizarSlide({ id: slideAtivoId, dadosJson: { componentes } });
      if (res.success) {
        marcarSalvo();
      } else {
        setSaving(false);
        toast.error(typeof res.error === "string" ? res.error : "Erro ao salvar automaticamente.");
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [componentes, isDirty, slideAtivoId, marcarSalvo, setSaving]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || over.id !== "canvas-droppable") return;

    const tipo = active.data.current?.tipo as TipoComponente | undefined;
    if (!tipo) return;

    const centroX = CANVAS_DIMENSOES.w / 2 - 60;
    const centroY = CANVAS_DIMENSOES.h / 2 - 40;
    const novoComponente = COMPONENTES_REGISTRY[tipo].criarComponentePadrao(centroX, centroY);
    adicionarComponente(novoComponente);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex h-screen flex-col bg-[#020617] text-slate-200">
        <BarraSuperiorEditor
          titulo={titulo}
          apresentacaoId={apresentacaoId}
          temaAtualId={tema?.id ?? null}
          onTemaAplicado={setTema}
        />
        <div className="flex flex-1 overflow-hidden">
          <aside className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-white/5 bg-slate-950/60">
            <SidebarSlides />
            <div className="h-px bg-white/5" />
            <SidebarComponentes />
          </aside>

          <main className="flex-1 overflow-hidden">
            <CanvasArea tema={tema} />
          </main>

          <aside className="w-72 shrink-0 overflow-y-auto border-l border-white/5 bg-slate-950/60">
            <PainelPropriedades />
          </aside>
        </div>
        <TimelineReal />
      </div>
    </DndContext>
  );
}
