"use client";

import { useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Copy, Trash2, Pencil, Upload, ChevronDown, GripVertical, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import {
  AtualizarSlide,
  CriarSlide,
  ExcluirSlide,
  DuplicarSlide,
  ObterSlide,
  ListarSlides,
  ReordenarSlides,
  AlternarVisibilidadeSlide,
} from "@/actions/slides";
import { serializarPersistenciaSlide, useEditorStore } from "../store/useEditorStore";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import { CANVAS_PADRAO, obterCanvasSeguro, type CanvasConfig } from "@/lib/apresentacoes/canvas";
import type { SlideAnimationConfig } from "@/lib/apresentacoes/animacao/tipos";
import { ModalPreImportarPptx } from "./ModalPreImportarPptx";

interface DadosSlidePersistidos {
  componentes: ComponenteSlide[];
  canvas?: CanvasConfig;
  animacaoConfig?: SlideAnimationConfig;
}

function ItemSlide({ id, ordem, nome, ativo, oculto, podeExcluir, onSelecionar, onDuplicar, onExcluir, onRenomear, onAlternarVisibilidade }: {
  id: string;
  ordem: number;
  nome: string | null;
  ativo: boolean;
  oculto: boolean;
  podeExcluir: boolean;
  onSelecionar: () => void;
  onDuplicar: () => void;
  onExcluir: () => void;
  onRenomear: (novoNome: string) => void;
  onAlternarVisibilidade: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : oculto ? 0.5 : 1 };
  const rotulo = nome || `Slide ${ordem + 1}`;
  const [editando, setEditando] = useState(false);
  const [valorEdicao, setValorEdicao] = useState(rotulo);

  function iniciarEdicao(e: MouseEvent) {
    e.stopPropagation();
    setValorEdicao(rotulo);
    setEditando(true);
  }

  function confirmarEdicao() {
    setEditando(false);
    if (valorEdicao.trim() && valorEdicao.trim() !== nome) onRenomear(valorEdicao);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
    if (e.key === "Escape") { e.preventDefault(); setEditando(false); }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelecionar}
      className={`group flex cursor-pointer items-center gap-2 rounded-xl border p-2 text-xs transition-colors ${
        ativo ? "border-indigo-500/40 bg-indigo-500/10 text-white" : "border-white/5 bg-slate-900/40 text-slate-400 hover:border-white/10"
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Mover ${rotulo}`}
        title="Arraste para reordenar"
        className="flex cursor-grab touch-none items-center gap-0.5 px-1 text-slate-600 hover:text-white active:cursor-grabbing"
      >
        <GripVertical size={12} aria-hidden="true" />
        <span>{ordem + 1}</span>
      </button>
      {editando ? (
        <input
          autoFocus
          value={valorEdicao}
          onChange={(e) => setValorEdicao(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={confirmarEdicao}
          onKeyDown={handleKeyDown}
          aria-label="Nome do slide"
          className="min-w-0 flex-1 rounded bg-slate-800 px-1.5 py-0.5 text-xs text-white outline-none ring-1 ring-indigo-500"
        />
      ) : (
        <span className={`flex-1 truncate ${oculto ? "italic text-slate-500" : ""}`}>{rotulo}</span>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onAlternarVisibilidade(); }}
        aria-label={oculto ? "Reexibir slide" : "Ocultar slide"}
        title={oculto ? "Slide oculto — clique para reexibir" : "Ocultar slide (não aparece no link, export ou apresentação)"}
        className={`cursor-pointer rounded p-1 hover:text-white hover:bg-white/10 ${
          oculto ? "text-amber-400 opacity-100" : "text-slate-500 opacity-0 group-hover:opacity-100"
        }`}
      >
        {oculto ? <EyeOff size={12} aria-hidden="true" /> : <Eye size={12} aria-hidden="true" />}
      </button>
      <button
        onClick={iniciarEdicao}
        aria-label="Renomear slide"
        className="cursor-pointer rounded p-1 text-slate-500 opacity-0 hover:text-white hover:bg-white/10 group-hover:opacity-100"
      >
        <Pencil size={12} aria-hidden="true" />
      </button>
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
  const atualizarVisibilidadeSlide = useEditorStore((s) => s.atualizarVisibilidadeSlide);
  const [processando, setProcessando] = useState(false);
  const [arquivoPptxSelecionado, setArquivoPptxSelecionado] = useState<File | null>(null);
  const [modalPreImportarAberto, setModalPreImportarAberto] = useState(false);
  const [gavetaAberta, setGavetaAberta] = useState(true);
  const inputPptxRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function persistirSlideAtivoSeNecessario() {
    const maximoTentativas = 6;

    for (let tentativa = 0; tentativa < maximoTentativas; tentativa += 1) {
      const estado = useEditorStore.getState();
      if (!estado.slideAtivoId || !estado.isDirty) return true;

      const slideIdSnapshot = estado.slideAtivoId;
      const componentesSnapshot = estado.componentes;
      const canvasSnapshot = estado.canvas;
      const animacaoConfigSnapshot = estado.animacaoConfig;
      const transicaoEntradaSnapshot = estado.transicaoEntrada;
      const versaoSnapshot = estado.versaoEdicao;
      estado.setSaving(true);

      let sucesso = false;
      let mensagemErro: string | null = null;
      try {
        const res = await serializarPersistenciaSlide(slideIdSnapshot, () => AtualizarSlide({
          id: slideIdSnapshot,
          dadosJson: { componentes: componentesSnapshot, canvas: canvasSnapshot, animacaoConfig: animacaoConfigSnapshot },
          transicaoEntrada: transicaoEntradaSnapshot,
        }));
        sucesso = res.success;
        if (!res.success) {
          mensagemErro = typeof res.error === "string" ? res.error : "Erro ao salvar o slide atual.";
        }
      } catch {
        mensagemErro = "Erro de conexão ao salvar o slide atual.";
      } finally {
        useEditorStore.getState().concluirSalvamento(slideIdSnapshot, versaoSnapshot, sucesso);
      }

      if (!sucesso) {
        useEditorStore.getState().setSaving(false);
        toast.error(mensagemErro ?? "Erro ao salvar o slide atual.");
        return false;
      }

      const estadoAtual = useEditorStore.getState();
      if (estadoAtual.slideAtivoId !== slideIdSnapshot) return false;
      if (!estadoAtual.isDirty) return true;
    }

    useEditorStore.getState().setSaving(false);
    toast.error("O slide continuou sendo editado durante o salvamento. Tente trocar novamente.");
    return false;
  }

  async function carregarSlideRemoto(slideId: string) {
    const res = await ObterSlide(slideId);
    if (res.success && res.data) {
      const dadosJson = res.data.dadosJson as DadosSlidePersistidos | null;
      carregarSlide(slideId, dadosJson?.componentes ?? [], obterCanvasSeguro(dadosJson?.canvas), dadosJson?.animacaoConfig, res.data.transicaoEntrada);
      return true;
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Erro ao abrir slide.");
      return false;
    }
  }

  async function handleSelecionar(slideId: string) {
    if (slideId === slideAtivoId || processando) return;
    setProcessando(true);
    try {
      if (!await persistirSlideAtivoSeNecessario()) return;
      await carregarSlideRemoto(slideId);
    } finally {
      setProcessando(false);
    }
  }

  async function handleAdicionar() {
    if (!apresentacaoId || processando) return;
    setProcessando(true);
    try {
      if (!await persistirSlideAtivoSeNecessario()) return;
      const res = await CriarSlide(apresentacaoId);
      if (res.success && res.data) {
        setSlides([...slides, {
          id: res.data.id,
          ordem: res.data.ordem,
          nome: res.data.nome,
          transicaoEntrada: null,
          componentes: [],
          canvas: CANVAS_PADRAO,
        }]);
        carregarSlide(res.data.id, [], CANVAS_PADRAO);
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Erro ao criar slide.");
      }
    } finally {
      setProcessando(false);
    }
  }

  function handleArquivoPptxSelecionado(arquivo: File) {
    if (!arquivo.name.toLowerCase().endsWith(".pptx")) {
      toast.error("Envie um arquivo .pptx (PowerPoint).");
      return;
    }
    setArquivoPptxSelecionado(arquivo);
    setModalPreImportarAberto(true);
  }

  /** Chamado pelo ModalPreImportarPptx após a importação real ser confirmada e persistida. */
  async function handleSlidesImportados() {
    if (!apresentacaoId) return;
    const listaAtualizada = await ListarSlides(apresentacaoId);
    if (listaAtualizada.success) {
      setSlides(listaAtualizada.data.map((s) => ({
        id: s.id,
        ordem: s.ordem,
        nome: s.nome,
        transicaoEntrada: s.transicaoEntrada ?? null,
        componentes: (s.dadosJson as { componentes: ComponenteSlide[] } | null)?.componentes ?? [],
        canvas: obterCanvasSeguro((s.dadosJson as DadosSlidePersistidos | null)?.canvas),
        oculto: s.oculto,
      })));
    }
  }

  async function handleDuplicar(slideId: string) {
    if (processando || !apresentacaoId) return;
    setProcessando(true);
    try {
      if (slideId === slideAtivoId && !await persistirSlideAtivoSeNecessario()) return;
      const res = await DuplicarSlide(slideId);
      if (res.success) {
        toast.success("Slide duplicado.");
        const listaAtualizada = await ListarSlides(apresentacaoId);
        if (listaAtualizada.success) {
          setSlides(listaAtualizada.data.map((s) => ({
            id: s.id,
            ordem: s.ordem,
            nome: s.nome,
            transicaoEntrada: s.transicaoEntrada ?? null,
            componentes: (s.dadosJson as { componentes: ComponenteSlide[] } | null)?.componentes ?? [],
            canvas: obterCanvasSeguro((s.dadosJson as DadosSlidePersistidos | null)?.canvas),
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
        // Renumera `ordem` localmente, espelhando o que ExcluirSlide já faz no banco — sem
        // isso, o rótulo padrão ("Slide N", calculado por ordem+1 quando não há nome
        // customizado) ficava com buraco depois de excluir um slide do meio/início.
        const restantes = slides.filter((s) => s.id !== slideId).map((s, i) => ({ ...s, ordem: i }));
        setSlides(restantes);
        if (slideAtivoId === slideId && restantes[0]) {
          await carregarSlideRemoto(restantes[0].id);
        }
        toast.success("Slide excluído.");
      } else {
        toast.error(typeof res.error === "string" ? res.error : "Erro ao excluir slide.");
      }
    } finally {
      setProcessando(false);
    }
  }

  /**
   * Renomeia um slide (ativo ou não). `AtualizarSlide` exige `dadosJson` válido mesmo só pra
   * mudar o nome — usa o estado AO VIVO do editor se for o slide ativo (pode ter edição não
   * salva ainda), ou o snapshot já carregado na sidebar caso contrário.
   */
  async function handleRenomear(slideId: string, novoNome: string) {
    const nomeFinal = novoNome.trim();
    if (!nomeFinal || processando) return;

    const ehAtivo = slideId === slideAtivoId;
    const slideLocal = slides.find((s) => s.id === slideId);
    if (!ehAtivo && !slideLocal) return;

    const dadosJson = ehAtivo
      ? { componentes: useEditorStore.getState().componentes, canvas: useEditorStore.getState().canvas }
      : { componentes: slideLocal!.componentes, canvas: slideLocal!.canvas };

    const res = await AtualizarSlide({ id: slideId, dadosJson, nome: nomeFinal });
    if (res.success) {
      setSlides(slides.map((s) => (s.id === slideId ? { ...s, nome: nomeFinal } : s)));
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Erro ao renomear slide.");
    }
  }

  async function handleAlternarVisibilidade(slideId: string, ocultoAtual: boolean) {
    if (processando) return;
    // Otimista — o toggle é uma ação leve e frequente, sem indicador de loading próprio.
    atualizarVisibilidadeSlide(slideId, !ocultoAtual);
    const res = await AlternarVisibilidadeSlide(slideId);
    if (!res.success) {
      atualizarVisibilidadeSlide(slideId, ocultoAtual);
      toast.error(typeof res.error === "string" ? res.error : "Erro ao alterar visibilidade do slide.");
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
    if (!res.success) {
      setSlides(slides);
      toast.error("Erro ao salvar a nova ordem dos slides. A ordem anterior foi restaurada.");
    }
  }

  return (
    <div className="flex shrink-0 flex-col gap-2 p-4 pb-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setGavetaAberta((aberta) => !aberta)}
          aria-expanded={gavetaAberta}
          aria-controls="gaveta-slides-alpha-motion"
          className="flex min-w-0 items-center gap-1.5 rounded py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300"
        >
          <ChevronDown size={13} className={`shrink-0 transition-transform ${gavetaAberta ? "" : "-rotate-90"}`} aria-hidden="true" />
          <span>Slides</span>
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] tabular-nums text-slate-600">{slides.length}</span>
        </button>
        <div className="flex items-center gap-0.5">
          <input
            ref={inputPptxRef}
            type="file"
            accept=".pptx"
            className="hidden"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              e.target.value = "";
              if (arquivo) handleArquivoPptxSelecionado(arquivo);
            }}
          />
          <button
            onClick={() => inputPptxRef.current?.click()}
            aria-label="Importar apresentação do PowerPoint (.pptx)"
            title="Importar .pptx"
            className="cursor-pointer rounded-lg p-1 text-slate-400 hover:text-white hover:bg-white/10"
          >
            <Upload size={14} aria-hidden="true" />
          </button>
          <button
            onClick={handleAdicionar}
            disabled={processando}
            aria-label="Adicionar slide"
            title="Adicionar slide"
            className="cursor-pointer rounded-lg p-1 text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-40"
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {gavetaAberta && (
        <div id="gaveta-slides-alpha-motion" className="max-h-[42dvh] min-h-0 overflow-y-auto pr-1">
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
                    oculto={Boolean(s.oculto)}
                    podeExcluir={slides.length > 1}
                    onSelecionar={() => handleSelecionar(s.id)}
                    onDuplicar={() => handleDuplicar(s.id)}
                    onExcluir={() => handleExcluir(s.id)}
                    onRenomear={(novoNome) => handleRenomear(s.id, novoNome)}
                    onAlternarVisibilidade={() => handleAlternarVisibilidade(s.id, Boolean(s.oculto))}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {apresentacaoId && (
        <ModalPreImportarPptx
          open={modalPreImportarAberto}
          onOpenChange={setModalPreImportarAberto}
          apresentacaoId={apresentacaoId}
          arquivo={arquivoPptxSelecionado}
          onImportado={() => void handleSlidesImportados()}
        />
      )}
    </div>
  );
}
