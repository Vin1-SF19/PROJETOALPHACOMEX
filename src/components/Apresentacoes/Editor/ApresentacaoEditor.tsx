"use client";

import { useEffect, useRef, useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { AtualizarSlide } from "@/actions/slides";
import { serializarPersistenciaSlide, useEditorStore, type SlideResumo } from "./store/useEditorStore";
import { ehPrimeiroSlide } from "@/lib/apresentacoes/proximo-slide";
import { capturarMiniaturaPrimeiroSlide } from "@/lib/apresentacoes/miniatura-captura";
import { COMPONENTES_REGISTRY, type TipoComponente } from "./registry/componentes-registry";
import { BarraSuperiorEditor } from "./BarraSuperior/BarraSuperiorEditor";
import { SidebarComponentes } from "./SidebarEsquerda/SidebarComponentes";
import { SidebarSlides } from "./SidebarEsquerda/SidebarSlides";
import { CanvasArea } from "./Canvas/CanvasArea";
import { PainelPropriedades } from "./PainelDireito/PainelPropriedades";
import { TimelineReal } from "./Timeline/TimelineReal";
import { TimelineRealV2 } from "./Timeline/TimelineRealV2";
import { ModalVisualizadorHtml } from "./ModalVisualizadorHtml";
import { ReducedMotionSimuladoProvider } from "./ReducedMotionSimuladoContext";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import type { CanvasConfig } from "@/lib/apresentacoes/canvas";
import type { SlideAnimationConfig } from "@/lib/apresentacoes/animacao/tipos";
import type { AssetApresentacao } from "@/lib/apresentacoes/assets";
import { desbloquearAudioContainer } from "@/lib/apresentacoes/container-carga-audio";
import type { PresetAnimacaoPersonalizado } from "@/lib/apresentacoes/animacao/presets-personalizados";
import { PresetsAnimacaoProvider } from "./PresetsAnimacaoContext";
import { EditorKeyboardShortcuts } from "./EditorKeyboardShortcuts";
import type { FontePersonalizada } from "@/lib/apresentacoes/fontes-personalizadas";
import { FontesPersonalizadasProvider } from "./FontesPersonalizadasContext";

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
  slugPublicoInicial: string | null;
  presetsAnimacaoIniciais: PresetAnimacaoPersonalizado[];
  fontesPersonalizadasIniciais: FontePersonalizada[];
  slidesIniciais: SlideResumo[];
  slideAtivoIdInicial: string;
  componentesIniciais: ComponenteSlide[];
  canvasInicial: CanvasConfig;
  animacaoConfigInicial?: SlideAnimationConfig;
  transicaoEntradaInicial?: string | null;
  assetsIniciais: AssetApresentacao[];
  temaInicial: TemaResumo | null;
}

export function ApresentacaoEditor({
  apresentacaoId,
  titulo,
  slugPublicoInicial,
  presetsAnimacaoIniciais,
  fontesPersonalizadasIniciais,
  slidesIniciais,
  slideAtivoIdInicial,
  componentesIniciais,
  canvasInicial,
  animacaoConfigInicial,
  transicaoEntradaInicial = null,
  assetsIniciais,
  temaInicial,
}: ApresentacaoEditorProps) {
  const [tema, setTema] = useState<TemaResumo | null>(temaInicial);
  const [modalApresentacaoAberto, setModalApresentacaoAberto] = useState(false);
  /** Promise do salvamento disparado pelo clique em "Apresentar" (se havia alteração pendente)
   * — ModalVisualizadorHtml espera ela terminar antes de buscar o HTML exportado, senão a
   * prévia poderia refletir uma versão desatualizada (a exportação lê do banco, não da memória). */
  const salvamentoPendenteApresentarRef = useRef<Promise<void> | null>(null);
  const inicializar = useEditorStore((s) => s.inicializar);
  const carregarSlide = useEditorStore((s) => s.carregarSlide);
  const componentes = useEditorStore((s) => s.componentes);
  const canvas = useEditorStore((s) => s.canvas);
  const animacaoConfig = useEditorStore((s) => s.animacaoConfig);
  const transicaoEntrada = useEditorStore((s) => s.transicaoEntrada);
  const slideAtivoId = useEditorStore((s) => s.slideAtivoId);
  const isDirty = useEditorStore((s) => s.isDirty);
  const versaoEdicao = useEditorStore((s) => s.versaoEdicao);
  const setSaving = useEditorStore((s) => s.setSaving);
  const adicionarComponente = useEditorStore((s) => s.adicionarComponente);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inicializadoRef = useRef(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    if (inicializadoRef.current) return;
    inicializadoRef.current = true;
    inicializar(apresentacaoId, slidesIniciais);
    carregarSlide(slideAtivoIdInicial, componentesIniciais, canvasInicial, animacaoConfigInicial, transicaoEntradaInicial);
  }, [apresentacaoId, slidesIniciais, slideAtivoIdInicial, componentesIniciais, canvasInicial, animacaoConfigInicial, transicaoEntradaInicial, inicializar, carregarSlide]);

  useEffect(() => {
    if (!isDirty || !slideAtivoId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const versaoSnapshot = versaoEdicao;
    debounceRef.current = setTimeout(() => {
      setSaving(true);
      void (async () => {
        let sucesso = false;
        try {
          const res = await serializarPersistenciaSlide(slideAtivoId, () => AtualizarSlide({
            id: slideAtivoId,
            dadosJson: { componentes, canvas, animacaoConfig },
            transicaoEntrada,
          }));
          sucesso = res.success;
          if (!res.success) {
            toast.error(typeof res.error === "string" ? res.error : "Erro ao salvar automaticamente.");
          }
        } catch {
          toast.error("Erro de conexão ao salvar automaticamente.");
        } finally {
          useEditorStore.getState().concluirSalvamento(slideAtivoId, versaoSnapshot, sucesso);
        }
        if (sucesso && ehPrimeiroSlide(useEditorStore.getState().slides, slideAtivoId)) {
          void capturarMiniaturaPrimeiroSlide(apresentacaoId);
        }
      })();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [componentes, canvas, animacaoConfig, transicaoEntrada, isDirty, slideAtivoId, versaoEdicao, setSaving, apresentacaoId]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || over.id !== "canvas-droppable") return;

    const tipo = active.data.current?.tipo as TipoComponente | undefined;
    if (!tipo) return;

    const centroX = canvas.width / 2 - 60;
    const centroY = canvas.height / 2 - 40;
    const novoComponente = COMPONENTES_REGISTRY[tipo].criarComponentePadrao(centroX, centroY);

    // Background: nasce cobrindo o canvas ativo (não o tamanho fixo do registry) e sempre
    // no zIndex mais baixo da lista — nunca deve tampar componentes já existentes no slide.
    if (novoComponente.tipo === "fundoAnimado") {
      const zIndexMinimo = componentes.length > 0 ? Math.min(...componentes.map((c) => c.zIndex)) - 1 : -1;
      adicionarComponente({ ...novoComponente, x: 0, y: 0, w: canvas.width, h: canvas.height, zIndex: zIndexMinimo });
      return;
    }

    // Container Alpha: é uma capa de tela cheia (não um elemento decorativo pequeno) — nasce
    // cobrindo o canvas ativo, mas mantém o zIndex normal (fica por cima, revelando o próximo
    // slide através da porta ao abrir — o oposto do Background, que deve ficar sempre atrás).
    if (novoComponente.tipo === "containerCarga") {
      adicionarComponente({ ...novoComponente, x: 0, y: 0, w: canvas.width, h: canvas.height });
      return;
    }

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

  async function salvarAlteracoesPendentes(): Promise<void> {
    const estado = useEditorStore.getState();
    if (!estado.isDirty || !estado.slideAtivoId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const slideIdSnapshot = estado.slideAtivoId;
    const versaoSnapshot = estado.versaoEdicao;
    setSaving(true);
    let sucesso = false;
    let mensagemErro = "Não foi possível salvar o slide antes de continuar.";
    try {
      const res = await serializarPersistenciaSlide(slideIdSnapshot, () => AtualizarSlide({
        id: slideIdSnapshot,
        dadosJson: {
          componentes: estado.componentes,
          canvas: estado.canvas,
          animacaoConfig: estado.animacaoConfig,
        },
        transicaoEntrada: estado.transicaoEntrada,
      }));
      sucesso = res.success;
      if (!res.success && typeof res.error === "string") mensagemErro = res.error;
    } catch {
      mensagemErro = "Erro de conexão ao salvar o slide antes de continuar.";
    } finally {
      useEditorStore.getState().concluirSalvamento(slideIdSnapshot, versaoSnapshot, sucesso);
    }
    if (!sucesso) throw new Error(mensagemErro);
  }

  function handleApresentar() {
    void desbloquearAudioContainer();
    salvamentoPendenteApresentarRef.current = salvarAlteracoesPendentes();

    setModalApresentacaoAberto(true);
  }

  return (
    <PresetsAnimacaoProvider apresentacaoId={apresentacaoId} presetsIniciais={presetsAnimacaoIniciais} aguardarAntesDeSalvar={salvarAlteracoesPendentes}>
    <FontesPersonalizadasProvider apresentacaoId={apresentacaoId} fontesIniciais={fontesPersonalizadasIniciais} aguardarAntesDeSalvar={salvarAlteracoesPendentes}>
    <ReducedMotionSimuladoProvider>
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex h-dvh min-h-0 flex-col bg-[#020617] text-slate-200">
        <EditorKeyboardShortcuts />
        <BarraSuperiorEditor
          titulo={titulo}
          apresentacaoId={apresentacaoId}
          slugPublicoInicial={slugPublicoInicial}
          aguardarAntesDeExportar={salvarAlteracoesPendentes}
          temaAtualId={tema?.id ?? null}
          onTemaAplicado={setTema}
          onSlideGeradoAplicado={handleSlideGeradoAplicado}
          onApresentar={handleApresentar}
          abrindoApresentacao={false}
          assetsIniciais={assetsIniciais}
          temaAtual={tema}
        />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside className="flex w-[clamp(11rem,18vw,16rem)] shrink-0 flex-col overflow-hidden border-r border-white/5 bg-slate-950/60">
            <SidebarSlides />
            <div className="h-px bg-white/5" />
            <SidebarComponentes />
          </aside>

          <main className="min-w-0 flex-1 overflow-hidden">
            <CanvasArea tema={tema} />
          </main>

          <aside className="w-[clamp(15rem,21vw,18rem)] shrink-0 overflow-y-auto border-l border-white/5 bg-slate-950/60">
            <PainelPropriedades />
          </aside>
        </div>
        <TimelineReal />
        <TimelineRealV2 />
        <ModalVisualizadorHtml
          open={modalApresentacaoAberto}
          onOpenChange={setModalApresentacaoAberto}
          apresentacaoId={apresentacaoId}
          titulo={titulo}
          aguardarAntesDeGerar={() => salvamentoPendenteApresentarRef.current}
        />
      </div>
    </DndContext>
    </ReducedMotionSimuladoProvider>
    </FontesPersonalizadasProvider>
    </PresetsAnimacaoProvider>
  );
}
