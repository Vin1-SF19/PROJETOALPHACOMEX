import type { ElementAnimation } from "@/lib/apresentacoes/animacao/tipos";
import { lerConfigResponsiva, type ResponsivoConfig } from "@/lib/apresentacoes/animacao/responsivo";
import { listarAnimacoes } from "@/lib/apresentacoes/animacao/registry";

interface CamposResponsividadeProps {
  animacao: ElementAnimation;
  onChange: (patch: Partial<ElementAnimation>) => void;
}

/**
 * Fase 09 — Seção 25 do prompt original ("UI de controle" de responsividade). A lógica em si
 * (aplicar essas regras durante o playback) é responsabilidade do motor desde a Fase 01 — este
 * componente só grava a config em `customProperties.responsivo`, seguindo o mesmo padrão de
 * `CamposEfeitosEspeciais.tsx` (patch parcial via `onChange`, extraído para caber no limite de
 * 300 linhas de `AnimacaoItemForm.tsx`).
 */
export function CamposResponsividade({ animacao, onChange }: CamposResponsividadeProps) {
  const config = lerConfigResponsiva(animacao);
  const opcoesFallback = listarAnimacoes();

  function set(patch: Partial<ResponsivoConfig>) {
    onChange({
      customProperties: {
        ...animacao.customProperties,
        responsivo: { ...config, ...patch },
      },
    });
  }

  return (
    <div className="space-y-2 border-t border-white/5 pt-2">
      <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500">Responsividade</p>

      <label className="flex items-center gap-2 text-[10px] text-slate-500">
        <input type="checkbox" checked={config.desktopOnly} onChange={(e) => set({ desktopOnly: e.target.checked })} className="cursor-pointer" />
        Animação só no desktop (mobile mostra o elemento direto, sem animação)
      </label>

      <div className="space-y-1">
        <label htmlFor={`resp-distancia-${animacao.id}`} className="text-[10px] text-slate-500">
          Distância de movimento no mobile ({Math.round(config.distanciaMobile * 100)}%)
        </label>
        <input
          id={`resp-distancia-${animacao.id}`}
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={config.distanciaMobile}
          onChange={(e) => set({ distanciaMobile: Number(e.target.value) })}
          className="w-full cursor-pointer accent-indigo-500"
        />
      </div>

      <label className="flex items-center gap-2 text-[10px] text-slate-500">
        <input type="checkbox" checked={config.desativarPin} onChange={(e) => set({ desativarPin: e.target.checked })} className="cursor-pointer" />
        Desativar Scroll Pinned/Sticky no mobile
      </label>

      <label className="flex items-center gap-2 text-[10px] text-slate-500">
        <input type="checkbox" checked={config.desativarParallax} onChange={(e) => set({ desativarParallax: e.target.checked })} className="cursor-pointer" />
        Desativar Parallax no mobile
      </label>

      <div className="space-y-1">
        <label htmlFor={`resp-fallback-${animacao.id}`} className="text-[10px] text-slate-500">
          Animação alternativa no mobile
        </label>
        <select
          id={`resp-fallback-${animacao.id}`}
          value={config.fallbackMobile ?? ""}
          onChange={(e) => set({ fallbackMobile: e.target.value || null })}
          className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
        >
          <option value="">Usar a mesma animação</option>
          {opcoesFallback.map((def) => (
            <option key={def.id} value={def.id}>
              {def.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
