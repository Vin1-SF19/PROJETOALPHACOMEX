import { Crosshair, RotateCcw, Trash2 } from "lucide-react";
import { useEditorStore } from "../store/useEditorStore";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import { TextoProps } from "./camposPorTipo/TextoProps";
import { ImagemProps } from "./camposPorTipo/ImagemProps";
import { BotaoProps } from "./camposPorTipo/BotaoProps";
import { CardProps } from "./camposPorTipo/CardProps";
import { GridProps } from "./camposPorTipo/GridProps";
import { IconeProps } from "./camposPorTipo/IconeProps";
import { DivisorProps } from "./camposPorTipo/DivisorProps";
import { GloboProps } from "./camposPorTipo/GloboProps";
import { ParticulasProps } from "./camposPorTipo/ParticulasProps";
import { ObjetoGlbProps } from "./camposPorTipo/ObjetoGlbProps";
import { VideoProps } from "./camposPorTipo/VideoProps";
import { AudioProps } from "./camposPorTipo/AudioProps";
import { ContainerProps } from "./camposPorTipo/ContainerProps";
import { GraficoProps } from "./camposPorTipo/GraficoProps";
import { TabelaProps } from "./camposPorTipo/TabelaProps";
import { KpiProps } from "./camposPorTipo/KpiProps";
import { ProgressoProps } from "./camposPorTipo/ProgressoProps";
import { RoadmapProps } from "./camposPorTipo/RoadmapProps";
import { ComparacaoProps } from "./camposPorTipo/ComparacaoProps";
import { FaqProps } from "./camposPorTipo/FaqProps";
import { ChecklistProps } from "./camposPorTipo/ChecklistProps";
import { GrafoProps } from "./camposPorTipo/GrafoProps";
import { DiagramaProps } from "./camposPorTipo/DiagramaProps";
import { ChatIlustrativoProps } from "./camposPorTipo/ChatIlustrativoProps";
import { ContainerCargaProps } from "./camposPorTipo/ContainerCargaProps";
import { FundoAnimadoProps } from "./camposPorTipo/FundoAnimadoProps";
import { AnimacaoProps } from "./camposPorTipo/AnimacaoProps";
import { AnimacaoPropsV2 } from "./camposPorTipo/AnimacaoPropsV2";
import { SharedElementIdInput } from "./camposPorTipo/SharedElementIdInput";

function buscarNaArvore(lista: ComponenteSlide[], id: string): ComponenteSlide | null {
  for (const c of lista) {
    if (c.id === id) return c;
    if ((c.tipo === "card" || c.tipo === "grid" || c.tipo === "container") && c.filhos.length > 0) {
      const achado = buscarNaArvore(c.filhos, id);
      if (achado) return achado;
    }
  }
  return null;
}

export function PainelPropriedades() {
  const componentes = useEditorStore((s) => s.componentes);
  const selecionadoId = useEditorStore((s) => s.componenteSelecionadoId);
  const selecionadosIds = useEditorStore((s) => s.componentesSelecionadosIds);
  const atualizarComponente = useEditorStore((s) => s.atualizarComponente);
  const atualizarComponentes = useEditorStore((s) => s.atualizarComponentes);
  const removerComponentes = useEditorStore((s) => s.removerComponentes);
  const centralizarSelecionados = useEditorStore((s) => s.centralizarSelecionados);

  const componente = selecionadoId ? buscarNaArvore(componentes, selecionadoId) : null;

  if (!componente) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-600">
        Selecione um componente para editar suas propriedades
      </div>
    );
  }

  function onChange(patch: Partial<ComponenteSlide>) {
    atualizarComponente(componente!.id, patch);
  }

  function handleExcluir() {
    removerComponentes(selecionadosIds.length > 0 ? selecionadosIds : [componente!.id]);
  }

  function atualizarRotacao(rotacao: number) {
    const ids = selecionadosIds.length > 0 ? selecionadosIds : [componente!.id];
    atualizarComponentes(Object.fromEntries(ids.map((id) => [id, { rotacao }])));
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Propriedades</h3>
          {selecionadosIds.length > 1 && <p className="mt-0.5 text-[10px] font-medium text-cyan-300">{selecionadosIds.length} elementos selecionados</p>}
        </div>
        <button
          onClick={handleExcluir}
          aria-label="Excluir componente"
          className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-400">X</label>
          <input
            type="number"
            value={Math.round(componente.x)}
            onChange={(e) => onChange({ x: Number(e.target.value) })}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-400">Y</label>
          <input
            type="number"
            value={Math.round(componente.y)}
            onChange={(e) => onChange({ y: Number(e.target.value) })}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-400">Largura</label>
          <input
            type="number"
            value={Math.round(componente.w)}
            onChange={(e) => onChange({ w: Number(e.target.value) })}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-400">Altura</label>
          <input
            type="number"
            value={Math.round(componente.h)}
            onChange={(e) => onChange({ h: Number(e.target.value) })}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <label className="space-y-1.5">
          <span className="text-[11px] text-slate-400">Rotação (graus)</span>
          <input
            type="number"
            min={-360}
            max={360}
            step={1}
            value={Math.round(componente.rotacao * 10) / 10}
            onChange={(e) => atualizarRotacao(Number(e.target.value))}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          />
        </label>
        <button
          type="button"
          onClick={() => atualizarRotacao(0)}
          aria-label="Zerar rotação"
          title="Zerar rotação"
          className="mt-5 flex size-9 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-slate-900 text-slate-400 hover:text-white"
        >
          <RotateCcw size={14} aria-hidden="true" />
        </button>
      </div>

      <button
        type="button"
        onClick={centralizarSelecionados}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs font-medium text-indigo-200 hover:bg-indigo-500/20"
      >
        <Crosshair size={14} aria-hidden="true" />
        {selecionadosIds.length > 1 ? "Centralizar conjunto no slide" : "Centralizar no slide"}
      </button>

      <div className="h-px bg-white/5" />

      {componente.tipo === "texto" && <TextoProps componente={componente} onChange={onChange} />}
      {componente.tipo === "imagem" && <ImagemProps componente={componente} onChange={onChange} />}
      {componente.tipo === "botao" && <BotaoProps componente={componente} onChange={onChange} />}
      {componente.tipo === "card" && <CardProps componente={componente} onChange={onChange} />}
      {componente.tipo === "grid" && <GridProps componente={componente} onChange={onChange} />}
      {componente.tipo === "icone" && <IconeProps componente={componente} onChange={onChange} />}
      {componente.tipo === "divisor" && <DivisorProps componente={componente} onChange={onChange} />}
      {componente.tipo === "globo" && <GloboProps componente={componente} onChange={onChange} />}
      {componente.tipo === "particulas" && <ParticulasProps componente={componente} onChange={onChange} />}
      {componente.tipo === "objeto3d" && <ObjetoGlbProps componente={componente} onChange={onChange} />}
      {componente.tipo === "containerCarga" && <ContainerCargaProps componente={componente} onChange={onChange} />}
      {componente.tipo === "video" && <VideoProps componente={componente} onChange={onChange} />}
      {componente.tipo === "audio" && <AudioProps componente={componente} onChange={onChange} />}
      {componente.tipo === "container" && <ContainerProps componente={componente} onChange={onChange} />}
      {componente.tipo === "grafico" && <GraficoProps componente={componente} onChange={onChange} />}
      {componente.tipo === "tabela" && <TabelaProps componente={componente} onChange={onChange} />}
      {componente.tipo === "kpi" && <KpiProps componente={componente} onChange={onChange} />}
      {componente.tipo === "progresso" && <ProgressoProps componente={componente} onChange={onChange} />}
      {componente.tipo === "roadmap" && <RoadmapProps componente={componente} onChange={onChange} />}
      {componente.tipo === "comparacao" && <ComparacaoProps componente={componente} onChange={onChange} />}
      {componente.tipo === "faq" && <FaqProps componente={componente} onChange={onChange} />}
      {componente.tipo === "checklist" && <ChecklistProps componente={componente} onChange={onChange} />}
      {componente.tipo === "grafo" && <GrafoProps componente={componente} onChange={onChange} />}
      {componente.tipo === "diagrama" && <DiagramaProps componente={componente} onChange={onChange} />}
      {componente.tipo === "chatIlustrativo" && <ChatIlustrativoProps componente={componente} onChange={onChange} />}
      {componente.tipo === "fundoAnimado" && <FundoAnimadoProps componente={componente} onChange={onChange} />}

      <AnimacaoProps componente={componente} onChange={onChange} />
      <AnimacaoPropsV2 componente={componente} />
      <SharedElementIdInput componente={componente} onChange={onChange} />
    </div>
  );
}
