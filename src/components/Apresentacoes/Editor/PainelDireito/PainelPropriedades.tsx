import { Trash2 } from "lucide-react";
import { useEditorStore } from "../store/useEditorStore";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import { TextoProps } from "./camposPorTipo/TextoProps";
import { ImagemProps } from "./camposPorTipo/ImagemProps";
import { BotaoProps } from "./camposPorTipo/BotaoProps";
import { CardProps } from "./camposPorTipo/CardProps";
import { GridProps } from "./camposPorTipo/GridProps";
import { IconeProps } from "./camposPorTipo/IconeProps";
import { DivisorProps } from "./camposPorTipo/DivisorProps";
import { AnimacaoProps } from "./camposPorTipo/AnimacaoProps";

function buscarNaArvore(lista: ComponenteSlide[], id: string): ComponenteSlide | null {
  for (const c of lista) {
    if (c.id === id) return c;
    if ((c.tipo === "card" || c.tipo === "grid") && c.filhos.length > 0) {
      const achado = buscarNaArvore(c.filhos, id);
      if (achado) return achado;
    }
  }
  return null;
}

export function PainelPropriedades() {
  const componentes = useEditorStore((s) => s.componentes);
  const selecionadoId = useEditorStore((s) => s.componenteSelecionadoId);
  const atualizarComponente = useEditorStore((s) => s.atualizarComponente);
  const removerComponente = useEditorStore((s) => s.removerComponente);
  const selecionarComponente = useEditorStore((s) => s.selecionarComponente);

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
    removerComponente(componente!.id);
    selecionarComponente(null);
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Propriedades</h3>
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

      <div className="h-px bg-white/5" />

      {componente.tipo === "texto" && <TextoProps componente={componente} onChange={onChange} />}
      {componente.tipo === "imagem" && <ImagemProps componente={componente} onChange={onChange} />}
      {componente.tipo === "botao" && <BotaoProps componente={componente} onChange={onChange} />}
      {componente.tipo === "card" && <CardProps componente={componente} onChange={onChange} />}
      {componente.tipo === "grid" && <GridProps componente={componente} onChange={onChange} />}
      {componente.tipo === "icone" && <IconeProps componente={componente} onChange={onChange} />}
      {componente.tipo === "divisor" && <DivisorProps componente={componente} onChange={onChange} />}

      <AnimacaoProps componente={componente} onChange={onChange} />
    </div>
  );
}
