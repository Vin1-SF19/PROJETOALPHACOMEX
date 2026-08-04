import { ANIMACAO_TIPOS, EASING_TIPOS, type ConfigAnimacao } from "@/lib/validations/animacao";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import { ANIMACAO_CONTAINER_ALPHA_PADRAO } from "@/lib/apresentacoes/animacao-container-alpha";
import { AnimacaoContainerAlphaProps } from "./AnimacaoContainerAlphaProps";

const LABEL_TIPO: Record<(typeof ANIMACAO_TIPOS)[number], string> = {
  fade: "Fade",
  "slide-up": "Deslizar de baixo",
  "slide-down": "Deslizar de cima",
  "slide-left": "Deslizar da direita",
  "slide-right": "Deslizar da esquerda",
  "zoom-in": "Zoom (aproximar)",
  "zoom-out": "Zoom (afastar)",
  flip: "Virar (flip)",
  bounce: "Saltar (bounce)",
  blur: "Desfoque",
  stagger: "Cascata (filhos)",
  typing: "Digitação",
  counter: "Contador numérico",
  "container-alpha": "Container Alpha — abertura da apresentação",
};

const DEFAULT_ANIMACAO: ConfigAnimacao = { tipo: "fade", duracao: 0.5, delay: 0, easing: "easeOut" };

interface AnimacaoPropsProps {
  componente: ComponenteSlide;
  onChange: (patch: Partial<ComponenteSlide>) => void;
}

/** Seção COMUM a todos os tipos de componente — sempre anexada após o formulário específico do tipo. */
export function AnimacaoProps({ componente, onChange }: AnimacaoPropsProps) {
  const anim = componente.animacao?.entrada;
  const ehContainer = componente.tipo === "card" || componente.tipo === "grid" || componente.tipo === "container";
  const ehTexto = componente.tipo === "texto";

  function atualizarAnimacao(patch: Partial<ConfigAnimacao> | null) {
    if (patch === null) {
      onChange({ animacao: { ...componente.animacao, entrada: undefined } });
      return;
    }
    onChange({ animacao: { ...componente.animacao, entrada: { ...DEFAULT_ANIMACAO, ...anim, ...patch } } });
  }

  function selecionarTipo(tipo: ConfigAnimacao["tipo"] | "") {
    if (!tipo) {
      atualizarAnimacao(null);
      return;
    }
    atualizarAnimacao({
      tipo,
      delay: tipo === "container-alpha" ? 0 : anim?.delay ?? DEFAULT_ANIMACAO.delay,
      containerAlpha: tipo === "container-alpha"
        ? anim?.containerAlpha ?? ANIMACAO_CONTAINER_ALPHA_PADRAO
        : undefined,
    });
  }

  const tiposDisponiveis = ANIMACAO_TIPOS.filter((t) => {
    if (t === "stagger") return ehContainer;
    if (t === "typing" || t === "counter") return ehTexto;
    return true;
  });

  return (
    <div className="space-y-3 border-t border-white/5 pt-4">
      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Animação de entrada</h4>

      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Tipo</label>
        <select
          value={anim?.tipo ?? ""}
          onChange={(event) => selecionarTipo(event.target.value as ConfigAnimacao["tipo"] | "")}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        >
          <option value="">Nenhuma</option>
          {tiposDisponiveis.map((t) => (
            <option key={t} value={t}>
              {LABEL_TIPO[t]}
            </option>
          ))}
        </select>
      </div>

      {anim?.tipo === "container-alpha" ? (
        <AnimacaoContainerAlphaProps animacao={anim} onChange={atualizarAnimacao} />
      ) : anim ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400">Duração (s)</label>
              <input
                type="number"
                min={0.1}
                max={5}
                step={0.1}
                value={anim.duracao}
                onChange={(e) => atualizarAnimacao({ duracao: Number(e.target.value) })}
                className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400">Delay (s)</label>
              <input
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={anim.delay}
                onChange={(e) => atualizarAnimacao({ delay: Number(e.target.value) })}
                className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400">Suavização</label>
            <select
              value={anim.easing}
              onChange={(e) => atualizarAnimacao({ easing: e.target.value as ConfigAnimacao["easing"] })}
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
            >
              {EASING_TIPOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>

          {anim.tipo === "stagger" && (
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400">Intervalo entre filhos (s)</label>
              <input
                type="number"
                min={0}
                max={2}
                step={0.05}
                value={anim.staggerDelay ?? 0.1}
                onChange={(e) => atualizarAnimacao({ staggerDelay: Number(e.target.value) })}
                className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {anim.tipo === "typing" && (
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400">Velocidade (caracteres/s)</label>
              <input
                type="number"
                min={1}
                max={200}
                value={anim.velocidadeDigitacao ?? 20}
                onChange={(e) => atualizarAnimacao({ velocidadeDigitacao: Number(e.target.value) })}
                className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {anim.tipo === "counter" && (
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400">Valor final</label>
              <input
                type="number"
                value={anim.valorFinal ?? 0}
                onChange={(e) => atualizarAnimacao({ valorFinal: Number(e.target.value) })}
                className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
              />
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
