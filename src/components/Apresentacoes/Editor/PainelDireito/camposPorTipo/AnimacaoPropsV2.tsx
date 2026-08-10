import { useState } from "react";
import { Layers3, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useEditorStore } from "../../store/useEditorStore";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import type { AnimationCategoria, ElementAnimation } from "@/lib/apresentacoes/animacao/tipos";
import { listarAnimacoes } from "@/lib/apresentacoes/animacao/registry";
import { AnimacaoItemForm } from "./AnimacaoItemForm";
import { PreviewMiniatura } from "./PreviewMiniatura";
import { SeletorPreset } from "./SeletorPreset";
import "@/lib/apresentacoes/animacao";

interface AnimacaoPropsV2Props {
  componente: ComponenteSlide;
}

type AbaAnimacao = AnimationCategoria | "scroll";

const ABAS: { id: AbaAnimacao; label: string }[] = [
  { id: "entrance", label: "Entrada" },
  { id: "emphasis", label: "Ênfase" },
  { id: "exit", label: "Saída" },
  { id: "interaction", label: "Interação" },
  { id: "scroll", label: "Rolagem" },
];

const TIPOS_SCROLL = new Set([
  "fade-in", "fade-up", "fade-down", "fade-left", "fade-right", "blur-in",
  "slide-in-left", "slide-in-right", "slide-in-up", "slide-in-down",
  "scale-in", "zoom-in", "pop-in", "rotate-in",
]);

function coletarIdsAnimaveis(componentes: ComponenteSlide[], tipoAnimacao: string): string[] {
  const ids: string[] = [];
  for (const item of componentes) {
    if (item.tipo === "fundoAnimado") continue;
    const ehContainer = item.tipo === "card" || item.tipo === "grid" || item.tipo === "container";
    if (tipoAnimacao !== "stagger" || ehContainer) ids.push(item.id);
    if (ehContainer) {
      ids.push(...coletarIdsAnimaveis(item.filhos, tipoAnimacao));
    }
  }
  return ids;
}

/** Painel do novo modelo de animações, incluindo interação real, scroll reveal e aplicação em lote. */
export function AnimacaoPropsV2({ componente }: AnimacaoPropsV2Props) {
  const [abaAtiva, setAbaAtiva] = useState<AbaAnimacao>("entrance");
  const [tipoEmPreview, setTipoEmPreview] = useState("");
  const componentes = useEditorStore((state) => state.componentes);
  const animacaoConfig = useEditorStore((state) => state.animacaoConfig);
  const adicionarAnimacaoElemento = useEditorStore((state) => state.adicionarAnimacaoElemento);
  const adicionarAnimacoesElementos = useEditorStore((state) => state.adicionarAnimacoesElementos);
  const removerAnimacaoElemento = useEditorStore((state) => state.removerAnimacaoElemento);
  const atualizarAnimacaoElemento = useEditorStore((state) => state.atualizarAnimacaoElemento);
  const animacoesAtuais = animacaoConfig?.timeline?.animations ?? [];

  const animacoesDoElemento = animacoesAtuais.filter(
    (animacao) => animacao.elementId === componente.id
      && (abaAtiva === "scroll"
        ? animacao.trigger === "on-scroll"
        : animacao.category === abaAtiva && animacao.trigger !== "on-scroll"),
  );
  const opcoesCatalogo = abaAtiva === "scroll"
    ? listarAnimacoes("entrance").filter((definicao) => TIPOS_SCROLL.has(definicao.id))
    : listarAnimacoes(abaAtiva);
  const definicaoEmPreview = opcoesCatalogo.find((definicao) => definicao.id === tipoEmPreview);

  function criarAnimacao(tipo: string, elementId: string): ElementAnimation {
    const definicao = opcoesCatalogo.find((item) => item.id === tipo);
    return {
      id: `anim-${crypto.randomUUID()}`,
      elementId,
      category: abaAtiva === "scroll" ? "entrance" : abaAtiva,
      type: tipo,
      trigger: abaAtiva === "scroll" ? "on-scroll" : definicao?.defaultTrigger ?? "on-slide-enter",
      duration: definicao?.defaultDuration ?? 0.5,
      delay: 0,
      order: animacoesAtuais.filter((animacao) => animacao.elementId === elementId).length,
      easing: definicao?.defaultEasing ?? { curva: "easeOut" },
      ...(abaAtiva === "scroll"
        ? { customProperties: { percentualVisivel: 0.3, executarUmaVez: true, delay: 0 } }
        : {}),
    };
  }

  function adicionar(tipo: string) {
    adicionarAnimacaoElemento(criarAnimacao(tipo, componente.id));
  }

  function adicionarEmTodos(tipo: string) {
    const modelo = criarAnimacao(tipo, componente.id);
    const ids = coletarIdsAnimaveis(componentes, tipo).filter((elementId) =>
      !animacoesAtuais.some(
        (animacao) => animacao.elementId === elementId && animacao.type === tipo && animacao.trigger === modelo.trigger,
      ),
    );
    const novas = ids.map((elementId) => criarAnimacao(tipo, elementId));
    adicionarAnimacoesElementos(novas);
    if (novas.length === 0) toast.info("Esse efeito já está aplicado a todos os elementos do slide.");
    else toast.success(`Efeito aplicado a ${novas.length} elemento${novas.length === 1 ? "" : "s"} do slide.`);
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
            onClick={() => {
              setAbaAtiva(aba.id);
              setTipoEmPreview("");
            }}
            className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${abaAtiva === aba.id ? "bg-indigo-500/20 text-indigo-300" : "text-slate-400 hover:bg-white/5"}`}
          >
            {aba.label}
          </button>
        ))}
      </div>

      {animacoesDoElemento.map((animacao) => (
        <AnimacaoItemForm
          key={animacao.id}
          animacao={animacao}
          opcoes={opcoesCatalogo}
          ehContainer={componente.tipo === "card" || componente.tipo === "grid" || componente.tipo === "container"}
          onChange={(patch) => atualizarAnimacaoElemento(animacao.id, patch)}
          onRemover={() => removerAnimacaoElemento(animacao.id)}
        />
      ))}

      <div className="space-y-1.5">
        <label htmlFor={`nova-animacao-${componente.id}`} className="text-[11px] text-slate-400">
          {abaAtiva === "scroll" ? "Adicionar efeito de rolagem" : abaAtiva === "interaction" ? "Adicionar interação" : "Adicionar animação"}
        </label>
        <select
          id={`nova-animacao-${componente.id}`}
          value={tipoEmPreview}
          onChange={(event) => setTipoEmPreview(event.target.value)}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        >
          <option value="">Escolher tipo...</option>
          {opcoesCatalogo.map((definicao) => (
            <option key={definicao.id} value={definicao.id}>{definicao.name}</option>
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
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  adicionar(tipoEmPreview);
                  setTipoEmPreview("");
                }}
                className="cursor-pointer rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500"
              >
                Adicionar ao elemento
              </button>
              <button
                type="button"
                onClick={() => {
                  adicionarEmTodos(tipoEmPreview);
                  setTipoEmPreview("");
                }}
                className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20"
              >
                <Layers3 size={13} aria-hidden="true" />
                Aplicar a todos
              </button>
            </div>
          </>
        )}
      </div>

      <SeletorPreset elementoId={componente.id} />
    </div>
  );
}
