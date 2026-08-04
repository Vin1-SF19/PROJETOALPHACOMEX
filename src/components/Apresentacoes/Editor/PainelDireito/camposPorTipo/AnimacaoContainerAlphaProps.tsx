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
    estadoEditor: "fechado",
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
          <h5 className="text-xs font-bold text-slate-100">Abertura Container Alpha</h5>
          <p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">
            Ajuste o acabamento do container usado na abertura da apresentação.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Prévia do container</span>
          <p className="mt-0.5 text-[10px] text-slate-500">Visual isolado para conferir cores, metal, interior e marca.</p>
        </div>
        <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-slate-950 shadow-xl">
          <ContainerCargaRender
            componente={componentePreview}
            modo="editor"
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
