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
import { CanvasArea } from "./Canvas/CanvasArea";
import { PainelPropriedades } from "./PainelDireito/PainelPropriedades";
import { TimelineReal } from "./Timeline/TimelineReal";
import { ModalReproducaoApresentacao } from "./ModalReproducaoApresentacao";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import type { CanvasConfig } from "@/lib/apresentacoes/canvas";
import type { AssetApresentacao } from "@/lib/apresentacoes/assets";
import type { EntradaApresentacaoConfig } from "@/lib/apresentacoes/entrada-apresentacao";

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
  canvasInicial: CanvasConfig;
  entradaApresentacaoInicial: EntradaApresentacaoConfig | null;
  assetsIniciais: AssetApresentacao[];
  temaInicial: TemaResumo | null;
}

export function ApresentacaoEditor({
  apresentacaoId,
  titulo,
  slidesIniciais,
  slideAtivoIdInicial,
  componentesIniciais,
  canvasInicial,
  entradaApresentacaoInicial,
  assetsIniciais,
  temaInicial,
}: ApresentacaoEditorProps) {
  const [tema, setTema] = useState<TemaResumo | null>(temaInicial);
  const [modalApresentacaoAberto, setModalApresentacaoAberto] = useState(false);
  const [abrindoApresentacao, setAbrindoApresentacao] = useState(false);
  const inicializar = useEditorStore((s) => s.inicializar);
  const carregarSlide = useEditorStore((s) => s.carregarSlide);
  const componentes = useEditorStore((s) => s.componentes);
  const canvas = useEditorStore((s) => s.canvas);
  const entradaApresentacao = useEditorStore((s) => s.entradaApresentacao);
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
    carregarSlide(slideAtivoIdInicial, componentesIniciais, canvasInicial, entradaApresentacaoInicial);
  }, [apresentacaoId, slidesIniciais, slideAtivoIdInicial, componentesIniciais, canvasInicial, entradaApresentacaoInicial, inicializar, carregarSlide]);

  useEffect(() => {
    if (!isDirty || !slideAtivoId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaving(true);
      const res = await AtualizarSlide({
        id: slideAtivoId,
        dadosJson: {
          componentes,
          canvas,
          ...(entradaApresentacao ? { entradaApresentacao } : {}),
        },
      });
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
  }, [componentes, canvas, entradaApresentacao, isDirty, slideAtivoId, marcarSalvo, setSaving]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || over.id !== "canvas-droppable") return;

    const tipo = active.data.current?.tipo as TipoComponente | undefined;
    if (!tipo) return;

    const centroX = canvas.width / 2 - 60;
    const centroY = canvas.height / 2 - 40;
    const novoComponente = COMPONENTES_REGISTRY[tipo].criarComponentePadrao(centroX, centroY);
    adicionarComponente(novoComponente);
  }

  /**
   * Componentes gerados por IA são ADICIONADOS ao slide ativo, nunca substituem o que já existe —
   * menos destrutivo (usuário pode limpar manualmente se quiser um slide do zero) e consistente com
   * o mesmo comportamento de "adicionar componente" usado no resto do Editor.
   */
  function handleSlideGeradoAplicado(componentesGerados: ComponenteSlide[]) {
    for (const c of componentesGerados) adicionarComponente(c);
  }

  async function handleApresentar() {
    if (abrindoApresentacao) return;
    setAbrindoApresentacao(true);

    try {
      if (slideAtivoId && isDirty) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setSaving(true);
        const res = await AtualizarSlide({
          id: slideAtivoId,
          dadosJson: {
            componentes,
            canvas,
            ...(entradaApresentacao ? { entradaApresentacao } : {}),
          },
        });
        if (!res.success) {
          setSaving(false);
          toast.error(typeof res.error === "string" ? res.error : "Erro ao salvar antes de apresentar.");
          return;
        }
        marcarSalvo();
      }

      setModalApresentacaoAberto(true);
    } finally {
      setAbrindoApresentacao(false);
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex h-screen flex-col bg-[#020617] text-slate-200">
        <BarraSuperiorEditor
          titulo={titulo}
          apresentacaoId={apresentacaoId}
          temaAtualId={tema?.id ?? null}
          onTemaAplicado={setTema}
          onSlideGeradoAplicado={handleSlideGeradoAplicado}
          onApresentar={handleApresentar}
          abrindoApresentacao={abrindoApresentacao}
          assetsIniciais={assetsIniciais}
          temaAtual={tema}
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
        <ModalReproducaoApresentacao
          open={modalApresentacaoAberto}
          onOpenChange={setModalApresentacaoAberto}
          apresentacaoId={apresentacaoId}
          titulo={titulo}
        />
      </div>
    </DndContext>
  );
}
