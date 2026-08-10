import { Trash2 } from "lucide-react";
import type { ElementAnimation, AnimationTrigger, StaggerOrdem } from "@/lib/apresentacoes/animacao/tipos";
import { ANIMATION_TRIGGER_TIPOS, STAGGER_ORDEM_TIPOS } from "@/lib/apresentacoes/animacao/tipos";
import { listarAnimacoes } from "@/lib/apresentacoes/animacao/registry";
import { CURVA_SIMPLES_PARA_TECNICA, type CurvaSimples } from "@/lib/apresentacoes/animacao/curvas";
import { PRESETS_STAGGER, type PresetStaggerId } from "@/lib/apresentacoes/animacao/presets-stagger";
import { CamposEfeitosEspeciais } from "./CamposEfeitosEspeciais";
import { CamposResponsividade } from "./CamposResponsividade";
import { PreviewMiniatura } from "./PreviewMiniatura";

const CURVA_LABEL: Record<CurvaSimples, string> = {
  suave: "Suave",
  rapida: "Rápida",
  dinamica: "Dinâmica",
  elastica: "Elástica",
  cinematografica: "Cinematográfica",
};

/** Rótulos em português dos 10 gatilhos (Seção 9 do prompt original). */
const TRIGGER_LABEL: Record<AnimationTrigger, string> = {
  "on-slide-enter": "Ao entrar no slide",
  "on-click": "Ao clicar",
  "after-previous": "Após a anterior",
  "with-previous": "Junto com a anterior",
  "on-hover": "Ao passar o mouse",
  "on-visible": "Ao entrar na área visível",
  "on-scroll": "Ao rolar",
  "on-timeline": "Em ponto da timeline",
  "after-delay": "Após um tempo",
  "on-element-click": "Ao clicar em outro elemento",
};

const STAGGER_ORDEM_LABEL: Record<StaggerOrdem, string> = {
  "first-to-last": "Primeiro para último",
  "last-to-first": "Último para primeiro",
  "center-out": "Do centro para fora",
  "edges-in": "Das extremidades para o centro",
  random: "Ordem aleatória",
  manual: "Ordem manual",
};

function curvaSimplesDaAnimacao(anim: ElementAnimation): CurvaSimples {
  const entrada = Object.entries(CURVA_SIMPLES_PARA_TECNICA).find(([, tecnica]) => tecnica === anim.easing.curva);
  return (entrada?.[0] as CurvaSimples) ?? "suave";
}

interface AnimacaoItemFormProps {
  animacao: ElementAnimation;
  opcoes: ReturnType<typeof listarAnimacoes>;
  /** Controles de stagger só fazem sentido quando o elemento tem filhos (card/grid/container). */
  ehContainer: boolean;
  onChange: (patch: Partial<ElementAnimation>) => void;
  onRemover: () => void;
}

/** Formulário de UMA `ElementAnimation` — duração/delay/curva (Fase 02) + gatilho/stagger (Fase 03). */
export function AnimacaoItemForm({ animacao, opcoes, ehContainer, onChange, onRemover }: AnimacaoItemFormProps) {
  const definicao = opcoes.find((d) => d.id === animacao.type);
  const curvaAtual = curvaSimplesDaAnimacao(animacao);
  const propriedadesScroll = animacao.customProperties ?? {};

  function atualizarScroll(patch: Record<string, unknown>) {
    onChange({ customProperties: { ...propriedadesScroll, ...patch } });
  }

  function aplicarPreset(presetId: PresetStaggerId) {
    onChange({ stagger: PRESETS_STAGGER[presetId].criar() });
  }

  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-slate-900/60 p-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-200">{definicao?.name ?? animacao.type}</span>
        <button
          onClick={onRemover}
          aria-label={`Remover animação ${definicao?.name ?? animacao.type}`}
          className="cursor-pointer rounded p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 size={12} aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label htmlFor={`duracao-${animacao.id}`} className="text-[10px] text-slate-500">
            Duração (s)
          </label>
          <input
            id={`duracao-${animacao.id}`}
            type="number"
            min={0.1}
            max={5}
            step={0.1}
            value={animacao.duration}
            onChange={(e) => onChange({ duration: Number(e.target.value) })}
            className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`delay-${animacao.id}`} className="text-[10px] text-slate-500">
            Delay (s)
          </label>
          <input
            id={`delay-${animacao.id}`}
            type="number"
            min={0}
            max={5}
            step={0.1}
            value={animacao.delay}
            onChange={(e) => onChange({ delay: Number(e.target.value) })}
            className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor={`curva-${animacao.id}`} className="text-[10px] text-slate-500">
          Curva de velocidade
        </label>
        <select
          id={`curva-${animacao.id}`}
          value={curvaAtual}
          onChange={(e) => onChange({ easing: { curva: CURVA_SIMPLES_PARA_TECNICA[e.target.value as CurvaSimples] } })}
          className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
        >
          {(Object.keys(CURVA_SIMPLES_PARA_TECNICA) as CurvaSimples[]).map((curva) => (
            <option key={curva} value={curva}>
              {CURVA_LABEL[curva]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor={`gatilho-${animacao.id}`} className="text-[10px] text-slate-500">
          Gatilho
        </label>
        <select
          id={`gatilho-${animacao.id}`}
          value={animacao.trigger}
          onChange={(e) => onChange({ trigger: e.target.value as AnimationTrigger })}
          className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
        >
          {ANIMATION_TRIGGER_TIPOS.map((trigger) => (
            <option key={trigger} value={trigger}>
              {TRIGGER_LABEL[trigger]}
            </option>
          ))}
        </select>
      </div>

      {animacao.trigger === "on-scroll" && (
        <div className="space-y-2 rounded-md border border-cyan-400/15 bg-cyan-500/5 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">Configuração da rolagem</p>
          <label className="block space-y-1">
            <span className="text-[10px] text-slate-500">Percentual visível para iniciar</span>
            <input
              type="number"
              min={10}
              max={100}
              step={5}
              value={Math.round((typeof propriedadesScroll.percentualVisivel === "number" ? propriedadesScroll.percentualVisivel : 0.3) * 100)}
              onChange={(event) => atualizarScroll({ percentualVisivel: Math.min(1, Math.max(0.1, Number(event.target.value) / 100)) })}
              className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-[10px] text-slate-400">
            Executar somente uma vez
            <input
              type="checkbox"
              checked={propriedadesScroll.executarUmaVez !== false}
              onChange={(event) => atualizarScroll({ executarUmaVez: event.target.checked })}
              className="size-4 accent-cyan-500"
            />
          </label>
        </div>
      )}

      {ehContainer && animacao.type === "stagger" && (
        <div className="space-y-2 border-t border-white/5 pt-2">
          <div className="space-y-1">
            <label htmlFor={`stagger-preset-${animacao.id}`} className="text-[10px] text-slate-500">
              Preset de cascata
            </label>
            <select
              id={`stagger-preset-${animacao.id}`}
              value=""
              onChange={(e) => e.target.value && aplicarPreset(e.target.value as PresetStaggerId)}
              className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
            >
              <option value="">Escolher preset...</option>
              {Object.entries(PRESETS_STAGGER).map(([id, preset]) => (
                <option key={id} value={id}>
                  {preset.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label htmlFor={`stagger-ordem-${animacao.id}`} className="text-[10px] text-slate-500">
                Ordem
              </label>
              <select
                id={`stagger-ordem-${animacao.id}`}
                value={animacao.stagger?.ordem ?? "first-to-last"}
                onChange={(e) =>
                  onChange({
                    stagger: { ordem: e.target.value as StaggerOrdem, intervalo: animacao.stagger?.intervalo ?? 0.1 },
                  })
                }
                className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
              >
                {STAGGER_ORDEM_TIPOS.map((ordem) => (
                  <option key={ordem} value={ordem}>
                    {STAGGER_ORDEM_LABEL[ordem]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor={`stagger-intervalo-${animacao.id}`} className="text-[10px] text-slate-500">
                Intervalo (s)
              </label>
              <input
                id={`stagger-intervalo-${animacao.id}`}
                type="number"
                min={0}
                max={2}
                step={0.01}
                value={animacao.stagger?.intervalo ?? 0.1}
                onChange={(e) =>
                  onChange({
                    stagger: { ordem: animacao.stagger?.ordem ?? "first-to-last", intervalo: Number(e.target.value) },
                  })
                }
                className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      )}

      <CamposEfeitosEspeciais animacao={animacao} onChange={onChange} />
      <CamposResponsividade animacao={animacao} onChange={onChange} />
      <PreviewMiniatura animacao={animacao} />
    </div>
  );
}
