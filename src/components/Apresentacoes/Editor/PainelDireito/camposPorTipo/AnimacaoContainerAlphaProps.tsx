"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import type { ConfigAnimacao } from "@/lib/validations/animacao";
import type { ContainerCargaComponente } from "@/lib/validations/slide-componentes";
import {
  criarComponenteAnimacaoContainerAlpha,
  normalizarConfigAnimacaoContainerAlpha,
  type ConfigAnimacaoContainerAlpha,
} from "@/lib/apresentacoes/animacao-container-alpha";
import { ContainerCargaRender } from "@/components/Apresentacoes/Editor/RenderEngine/ContainerCargaRender";
import { useEditorStore } from "../../store/useEditorStore";
import { ContainerCargaProps } from "./ContainerCargaProps";

interface AnimacaoContainerAlphaPropsProps {
  animacao: ConfigAnimacao;
  onChange: (patch: Partial<ConfigAnimacao>) => void;
}

export function AnimacaoContainerAlphaProps({ animacao, onChange }: AnimacaoContainerAlphaPropsProps) {
  const canvas = useEditorStore((state) => state.canvas);
  const configuracao = normalizarConfigAnimacaoContainerAlpha(animacao.containerAlpha);
  const componentePreview = useMemo<ContainerCargaComponente>(() => ({
    ...criarComponenteAnimacaoContainerAlpha(configuracao, canvas),
    estadoEditor: "aberto",
    transicaoProximoSlide: false,
    somHabilitado: false,
  }), [canvas, configuracao]);

  function atualizarConfiguracao(patch: Partial<ContainerCargaComponente>) {
    const proxima: ConfigAnimacaoContainerAlpha = {
      ...configuracao,
      corPrincipal: patch.corPrincipal ?? configuracao.corPrincipal,
      corMetal: patch.corMetal ?? configuracao.corMetal,
      corInterior: patch.corInterior ?? configuracao.corInterior,
      anguloAbertura: patch.anguloAbertura ?? configuracao.anguloAbertura,
      duracaoAbertura: patch.duracaoAbertura ?? configuracao.duracaoAbertura,
      atrasoAbertura: patch.atrasoAbertura ?? configuracao.atrasoAbertura,
      duracaoZoom: patch.duracaoZoom ?? configuracao.duracaoZoom,
      somHabilitado: patch.somHabilitado ?? configuracao.somHabilitado,
      somAbertura: patch.somAbertura ?? configuracao.somAbertura,
      volumeSom: patch.volumeSom ?? configuracao.volumeSom,
      mostrarLogo: patch.mostrarLogo ?? configuracao.mostrarLogo,
    };
    onChange({ containerAlpha: proxima });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-indigo-400/20 bg-gradient-to-b from-indigo-500/10 to-slate-950/20 p-3 shadow-lg shadow-indigo-950/20">
      <div className="flex items-start gap-2.5">
        <div className="rounded-xl border border-indigo-400/25 bg-indigo-500/15 p-2 text-indigo-300">
          <Sparkles size={16} aria-hidden="true" />
        </div>
        <div>
          <h5 className="text-xs font-bold text-slate-100">Transição Container Alpha</h5>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] leading-relaxed text-slate-400">
            Slide atual <ArrowRight size={10} aria-hidden="true" /> próximo slide, sem corte intermediário.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Prévia real</span>
          <button
            type="button"
            onClick={reproduzirPreview}
            className="flex items-center gap-1.5 rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-indigo-300 transition-colors hover:bg-indigo-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <Play size={11} aria-hidden="true" />
            Reproduzir
          </button>
        </div>
        <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-black shadow-xl">
          <TransicaoContainerAlphaLayer
            key={previewKey}
            configuracao={configuracao}
            slideDestino={{
              componentes: proximoSlide?.componentes ?? null,
              canvas: proximoSlide?.canvas ?? canvas,
            }}
            pausado={false}
            onComplete={ignorarEvento}
          />
        </div>
      </div>

      <div className="h-px bg-white/5" />
      <ContainerCargaProps
        componente={componentePreview}
        onChange={atualizarConfiguracao}
        modo="entrada"
        idPrefix="animacao-container-alpha"
      />
    </div>
  );
}
