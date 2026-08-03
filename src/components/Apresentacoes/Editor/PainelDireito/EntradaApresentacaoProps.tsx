"use client";

import { useCallback, useState } from "react";
import { Play, Sparkles } from "lucide-react";
import { EntradaContainerAlphaLayer } from "../../ModoApresentacao/EntradaContainerAlphaLayer";
import { useEditorStore } from "../store/useEditorStore";
import { ContainerCargaProps } from "./camposPorTipo/ContainerCargaProps";
import {
  criarComponenteEntradaContainerAlpha,
  ENTRADA_CONTAINER_ALPHA_PADRAO,
  type EntradaApresentacaoConfig,
} from "@/lib/apresentacoes/entrada-apresentacao";
import type { ContainerCargaComponente } from "@/lib/validations/slide-componentes";

export function EntradaApresentacaoProps() {
  const [previewKey, setPreviewKey] = useState(0);
  const componentes = useEditorStore((state) => state.componentes);
  const canvas = useEditorStore((state) => state.canvas);
  const slides = useEditorStore((state) => state.slides);
  const slideAtivoId = useEditorStore((state) => state.slideAtivoId);
  const entrada = useEditorStore((state) => state.entradaApresentacao);
  const atualizarEntrada = useEditorStore((state) => state.atualizarEntradaApresentacao);
  const slideAtivo = slides.find((slide) => slide.id === slideAtivoId);
  const ehPrimeiroSlide = slideAtivo?.ordem === 0;

  const ignorarEventoIntro = useCallback(() => {}, []);

  function selecionarTipo(valor: string) {
    atualizarEntrada(valor === "container-alpha" ? ENTRADA_CONTAINER_ALPHA_PADRAO : null);
    setPreviewKey((atual) => atual + 1);
  }

  function atualizarConfiguracao(patch: Partial<ContainerCargaComponente>) {
    if (!entrada) return;
    const proxima: EntradaApresentacaoConfig = {
      ...entrada,
      corPrincipal: patch.corPrincipal ?? entrada.corPrincipal,
      corMetal: patch.corMetal ?? entrada.corMetal,
      corInterior: patch.corInterior ?? entrada.corInterior,
      anguloAbertura: patch.anguloAbertura ?? entrada.anguloAbertura,
      duracaoAbertura: patch.duracaoAbertura ?? entrada.duracaoAbertura,
      atrasoAbertura: patch.atrasoAbertura ?? entrada.atrasoAbertura,
      duracaoZoom: patch.duracaoZoom ?? entrada.duracaoZoom,
      somHabilitado: patch.somHabilitado ?? entrada.somHabilitado,
      somAbertura: patch.somAbertura ?? entrada.somAbertura,
      volumeSom: patch.volumeSom ?? entrada.volumeSom,
      mostrarLogo: patch.mostrarLogo ?? entrada.mostrarLogo,
    };
    atualizarEntrada(proxima);
  }

  if (!ehPrimeiroSlide) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <Sparkles className="text-indigo-400" size={24} aria-hidden="true" />
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Entrada da apresentação</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Selecione o primeiro slide para configurar a animação que abre a apresentação.
          </p>
        </div>
      </div>
    );
  }

  const componentePreview = entrada ? criarComponenteEntradaContainerAlpha(entrada, canvas) : null;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div>
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Entrada da apresentação</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          Executada como capa antes do primeiro slide. Não precisa adicionar o container ao canvas.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="entrada-apresentacao-tipo" className="text-[11px] text-slate-400">Animação</label>
        <select
          id="entrada-apresentacao-tipo"
          value={entrada?.tipo ?? ""}
          onChange={(event) => selecionarTipo(event.target.value)}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        >
          <option value="">Nenhuma</option>
          <option value="container-alpha">Container Alpha</option>
        </select>
      </div>

      {entrada && componentePreview && (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-300">Pré-visualização</span>
              <button
                type="button"
                onClick={() => setPreviewKey((atual) => atual + 1)}
                className="flex items-center gap-1.5 rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-indigo-300 transition-colors hover:bg-indigo-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <Play size={12} aria-hidden="true" />
                Reproduzir
              </button>
            </div>
            <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-black shadow-lg">
              <EntradaContainerAlphaLayer
                key={previewKey}
                configuracao={entrada}
                slideInicial={{ componentes, canvas }}
                pausado={false}
                onComplete={ignorarEventoIntro}
              />
            </div>
          </div>

          <div className="h-px bg-white/5" />
          <ContainerCargaProps componente={componentePreview} onChange={atualizarConfiguracao} modo="entrada" />
        </>
      )}
    </div>
  );
}
