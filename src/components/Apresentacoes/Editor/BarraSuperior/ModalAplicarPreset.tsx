"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useEditorStore } from "../store/useEditorStore";
import { PRESETS_ANIMACAO_COMPLETOS, type PresetAnimacaoCompletoId } from "@/lib/apresentacoes/animacao/presets-completos";
import { AtualizarSlide } from "@/actions/slides";
import type { ElementAnimation, SlideAnimationConfig } from "@/lib/apresentacoes/animacao/tipos";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";

interface ModalAplicarPresetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** IDs de nível superior do slide — presets aplicam-se a esses, não recursivamente aos filhos de containers (mesmo escopo de "elementos do slide" usado pela timeline hoje). */
function idsDeNivelSuperior(componentes: ComponenteSlide[]): string[] {
  return componentes.map((c) => c.id);
}

function gerarAnimacoesParaElementos(presetId: PresetAnimacaoCompletoId, elementIds: string[]): ElementAnimation[] {
  const parciais = PRESETS_ANIMACAO_COMPLETOS[presetId].criar();
  const animacoes: ElementAnimation[] = [];
  for (const elementId of elementIds) {
    for (const parcial of parciais) {
      animacoes.push({ ...parcial, id: `anim-${crypto.randomUUID()}`, elementId });
    }
  }
  return animacoes;
}

/**
 * Fase 09 — Seção 15 do prompt original: "aplicar a todos os elementos do slide" / "aplicar a
 * todos os slides", com confirmação via `AlertDialog` (nunca `confirm()` nativo) antes de
 * sobrescrever configurações existentes de vários slides de uma vez.
 */
export function ModalAplicarPreset({ open, onOpenChange }: ModalAplicarPresetProps) {
  const [presetId, setPresetId] = useState<PresetAnimacaoCompletoId | "">("");
  const [confirmacaoAberta, setConfirmacaoAberta] = useState(false);
  const [aplicandoTodos, setAplicandoTodos] = useState(false);
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 });

  const componentes = useEditorStore((s) => s.componentes);
  const animacaoConfig = useEditorStore((s) => s.animacaoConfig);
  const canvas = useEditorStore((s) => s.canvas);
  const slides = useEditorStore((s) => s.slides);
  const slideAtivoId = useEditorStore((s) => s.slideAtivoId);
  const carregarSlide = useEditorStore((s) => s.carregarSlide);
  const setSlides = useEditorStore((s) => s.setSlides);
  const marcarSujo = useEditorStore((s) => s.marcarSujo);

  function aplicarAoSlideAtivo() {
    if (!presetId) return;
    const novas = gerarAnimacoesParaElementos(presetId, idsDeNivelSuperior(componentes));
    const timelineAtual = animacaoConfig?.timeline ?? { duration: 0, animations: [] };
    const novoConfig: SlideAnimationConfig = {
      version: animacaoConfig?.version ?? 1,
      ...animacaoConfig,
      timeline: { ...timelineAtual, animations: [...timelineAtual.animations, ...novas] },
    };
    if (slideAtivoId) carregarSlide(slideAtivoId, componentes, canvas, novoConfig, useEditorStore.getState().transicaoEntrada);
    marcarSujo();
    toast.success(`Preset "${PRESETS_ANIMACAO_COMPLETOS[presetId].nome}" aplicado a ${componentes.length} elemento(s) do slide.`);
    onOpenChange(false);
  }

  async function aplicarATodosOsSlides() {
    if (!presetId) return;
    setAplicandoTodos(true);
    setProgresso({ atual: 0, total: slides.length });

    const slidesAtualizados = [...slides];
    let falhas = 0;

    for (let i = 0; i < slidesAtualizados.length; i += 1) {
      const slide = slidesAtualizados[i];
      const ehSlideAtivo = slide.id === slideAtivoId;
      const componentesDoSlide = ehSlideAtivo ? componentes : slide.componentes;
      const configDoSlide = ehSlideAtivo ? animacaoConfig : slide.animacaoConfig;

      const novas = gerarAnimacoesParaElementos(presetId, idsDeNivelSuperior(componentesDoSlide));
      const timelineAtual = configDoSlide?.timeline ?? { duration: 0, animations: [] };
      const novoConfig: SlideAnimationConfig = {
        version: configDoSlide?.version ?? 1,
        ...configDoSlide,
        timeline: { ...timelineAtual, animations: [...timelineAtual.animations, ...novas] },
      };

      // Lote sequencial deliberado: mantém a ordem de progresso e evita disparar N requests simultâneos contra o servidor.
      const res = await AtualizarSlide({
        id: slide.id,
        dadosJson: { componentes: componentesDoSlide, canvas: ehSlideAtivo ? canvas : slide.canvas, animacaoConfig: novoConfig },
      });

      if (res.success) {
        slidesAtualizados[i] = { ...slide, animacaoConfig: novoConfig };
      } else {
        falhas += 1;
      }
      setProgresso({ atual: i + 1, total: slidesAtualizados.length });
    }

    setSlides(slidesAtualizados);
    if (slideAtivoId) {
      const slideAtivoAtualizado = slidesAtualizados.find((s) => s.id === slideAtivoId);
      if (slideAtivoAtualizado) carregarSlide(slideAtivoId, componentes, canvas, slideAtivoAtualizado.animacaoConfig, useEditorStore.getState().transicaoEntrada);
    }

    setAplicandoTodos(false);
    setConfirmacaoAberta(false);
    onOpenChange(false);

    if (falhas > 0) toast.error(`Preset aplicado, mas ${falhas} de ${slidesAtualizados.length} slide(s) falharam ao salvar.`);
    else toast.success(`Preset "${PRESETS_ANIMACAO_COMPLETOS[presetId].nome}" aplicado a ${slidesAtualizados.length} slide(s).`);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="border-white/10 bg-slate-950 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Aplicar preset de animação</DialogTitle>
            <DialogDescription className="text-slate-400">
              Escolha um preset pronto — continua 100% editável depois de aplicado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {Object.entries(PRESETS_ANIMACAO_COMPLETOS).map(([id, preset]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPresetId(id as PresetAnimacaoCompletoId)}
                className={`w-full cursor-pointer rounded-lg border p-3 text-left transition-colors ${
                  presetId === id ? "border-indigo-500 bg-indigo-500/10" : "border-white/10 bg-slate-900/60 hover:border-white/20"
                }`}
              >
                <p className="text-sm font-medium text-white">{preset.nome}</p>
                <p className="text-xs text-slate-500">{preset.descricao}</p>
              </button>
            ))}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={!presetId}
              onClick={aplicarAoSlideAtivo}
              className="cursor-pointer rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-xs font-medium text-white hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Aplicar a este slide
            </button>
            <button
              type="button"
              disabled={!presetId || slides.length === 0}
              onClick={() => setConfirmacaoAberta(true)}
              className="cursor-pointer rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Aplicar a todos os slides ({slides.length})
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmacaoAberta} onOpenChange={setConfirmacaoAberta}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sobrescrever animações de {slides.length} slide(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso vai aplicar o preset &ldquo;{presetId ? PRESETS_ANIMACAO_COMPLETOS[presetId].nome : ""}&rdquo; a todos os elementos de
              nível superior de {slides.length} slide(s), somando às animações já existentes. Esta ação não pode ser desfeita
              automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {aplicandoTodos ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              Aplicando... {progresso.atual}/{progresso.total}
            </div>
          ) : (
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  // Impede o fechamento automático do Radix — o diálogo só fecha quando
                  // `aplicarATodosOsSlides` terminar (mostra progresso enquanto processa).
                  e.preventDefault();
                  void aplicarATodosOsSlides();
                }}
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
