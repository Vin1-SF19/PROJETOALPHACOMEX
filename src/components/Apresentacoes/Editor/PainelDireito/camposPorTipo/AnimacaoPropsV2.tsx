import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useEditorStore } from "../../store/useEditorStore";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import type { AnimationCategoria, ElementAnimation } from "@/lib/apresentacoes/animacao/tipos";
import { listarAnimacoes } from "@/lib/apresentacoes/animacao/registry";
import { AnimacaoItemForm } from "./AnimacaoItemForm";
import { PreviewMiniatura } from "./PreviewMiniatura";
import { SeletorPreset } from "./SeletorPreset";
import "@/lib/apresentacoes/animacao"; // garante o catálogo (69 animações) populado antes de listarAnimacoes()

interface AnimacaoPropsV2Props {
  componente: ComponenteSlide;
}

/**
 * `interaction` já existe em `AnimationCategoria` (desabilitada até a Fase 08 dar lógica
 * real de gatilho — a Fase 03 só resolve a ORDEM/dependência, não interações do usuário no
 * player). "Rolagem" não é uma `category` — é um sub-sistema à parte (`scroll` em
 * `SlideAnimationConfig`, Fase 08) — por isso fica fora do array navegável por categoria,
 * representada só como aba visualmente desabilitada, sem `id` de categoria válido.
 */
const ABAS: { id: AnimationCategoria; label: string; habilitada: boolean }[] = [
  { id: "entrance", label: "Entrada", habilitada: true },
  { id: "emphasis", label: "Ênfase", habilitada: true },
  { id: "exit", label: "Saída", habilitada: true },
  { id: "interaction", label: "Interação", habilitada: false },
];

/**
 * Painel de animações do Alpha Motion (Fase 02) — ADICIONAL ao painel legado (`AnimacaoProps`,
 * Onda 3), nunca o substitui. Grava em `Slide.animacaoConfig.timeline.animations[]` (decisão
 * registrada em `.bibble/memory/decisions.md`, 2026-08-06), não em `componente.animacao`.
 */
export function AnimacaoPropsV2({ componente }: AnimacaoPropsV2Props) {
  const [abaAtiva, setAbaAtiva] = useState<AnimationCategoria>("entrance");
  const [tipoEmPreview, setTipoEmPreview] = useState("");
  const animacaoConfig = useEditorStore((s) => s.animacaoConfig);
  const adicionarAnimacaoElemento = useEditorStore((s) => s.adicionarAnimacaoElemento);
  const removerAnimacaoElemento = useEditorStore((s) => s.removerAnimacaoElemento);

  const animacoesDoElemento = (animacaoConfig?.timeline?.animations ?? []).filter(
    (a) => a.elementId === componente.id && a.category === abaAtiva,
  );
  const opcoesCatalogo = listarAnimacoes(abaAtiva);
  const definicaoEmPreview = opcoesCatalogo.find((d) => d.id === tipoEmPreview);

  function adicionar(tipo: string) {
    const definicao = opcoesCatalogo.find((d) => d.id === tipo);
    const nova: ElementAnimation = {
      id: `anim-${crypto.randomUUID()}`,
      elementId: componente.id,
      category: abaAtiva,
      type: tipo,
      trigger: "on-slide-enter",
      duration: definicao?.defaultDuration ?? 0.5,
      delay: 0,
      order: animacoesDoElemento.length,
      easing: definicao?.defaultEasing ?? { curva: "easeOut" },
    };
    adicionarAnimacaoElemento(nova);
  }

  function atualizar(id: string, patch: Partial<ElementAnimation>) {
    const atual = animacoesDoElemento.find((a) => a.id === id);
    if (!atual) return;
    removerAnimacaoElemento(id);
    adicionarAnimacaoElemento({ ...atual, ...patch });
  }

  return (
    <div className="space-y-3 border-t border-white/5 pt-4">
      <div className="flex items-center gap-1.5">
        <Sparkles size={12} className="text-indigo-400" aria-hidden="true" />
        <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Animações (Alpha Motion)</h4>
      </div>

      <div role="tablist" aria-label="Categoria de animação" className="flex flex-wrap gap-1">
        {ABAS.map((aba) => (
          <button
            key={aba.id}
            role="tab"
            aria-selected={abaAtiva === aba.id}
            disabled={!aba.habilitada}
            onClick={() => aba.habilitada && setAbaAtiva(aba.id)}
            className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
              !aba.habilitada
                ? "cursor-not-allowed text-slate-600"
                : abaAtiva === aba.id
                  ? "bg-indigo-500/20 text-indigo-300"
                  : "text-slate-400 hover:bg-white/5"
            }`}
          >
            {aba.label}
            {!aba.habilitada && <span className="ml-1 text-slate-700">(em breve)</span>}
          </button>
        ))}
        {/* "Rolagem" não é uma AnimationCategoria (é o sub-sistema `scroll`, Fase 08) — item puramente visual, sem estado de seleção. */}
        <button disabled className="cursor-not-allowed rounded-md px-2 py-1 text-[10px] font-medium text-slate-600">
          Rolagem<span className="ml-1 text-slate-700">(em breve)</span>
        </button>
      </div>

      {animacoesDoElemento.map((anim) => (
        <AnimacaoItemForm
          key={anim.id}
          animacao={anim}
          opcoes={opcoesCatalogo}
          ehContainer={componente.tipo === "card" || componente.tipo === "grid" || componente.tipo === "container"}
          onChange={(patch) => atualizar(anim.id, patch)}
          onRemover={() => removerAnimacaoElemento(anim.id)}
        />
      ))}

      <div className="space-y-1.5">
        <label htmlFor={`nova-animacao-${componente.id}`} className="text-[11px] text-slate-400">
          Adicionar animação
        </label>
        <select
          id={`nova-animacao-${componente.id}`}
          value={tipoEmPreview}
          onChange={(e) => setTipoEmPreview(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        >
          <option value="">Escolher tipo...</option>
          {opcoesCatalogo.map((def) => (
            <option key={def.id} value={def.id}>
              {def.name}
            </option>
          ))}
        </select>
        {definicaoEmPreview && (
          <>
            <PreviewMiniatura
              animacao={{
                type: definicaoEmPreview.id,
                duration: definicaoEmPreview.defaultDuration,
                delay: 0,
                easing: definicaoEmPreview.defaultEasing,
              }}
            />
            <button
              type="button"
              onClick={() => {
                adicionar(tipoEmPreview);
                setTipoEmPreview("");
              }}
              className="w-full cursor-pointer rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
            >
              Adicionar {definicaoEmPreview.name}
            </button>
          </>
        )}
      </div>

      <SeletorPreset elementoId={componente.id} />
    </div>
  );
}
