import { useState } from "react";
import { Wand2 } from "lucide-react";
import { useEditorStore } from "../../store/useEditorStore";
import type { ElementAnimation } from "@/lib/apresentacoes/animacao/tipos";
import { listarPresetsAnimacaoDisponiveis } from "@/lib/apresentacoes/animacao/presets-personalizados";
import { usePresetsAnimacao } from "../../PresetsAnimacaoContext";

interface SeletorPresetProps {
  elementoId: string;
}

/**
 * Fase 09 — Seção 16 do prompt original: "Presets completos" aplicados ao elemento SELECIONADO
 * no Editor (`elementoId`, sempre o singular — não há multi-seleção no Editor hoje). Cada
 * `AnimacaoPreset` (Echo, `presets-completos.ts`) é parcial (sem `id`/`elementId`); aqui é o
 * único lugar que preenche os dois na aplicação. Continua 100% editável depois — vira animações
 * comuns na timeline, editáveis normalmente via `AnimacaoItemForm`.
 */
export function SeletorPreset({ elementoId }: SeletorPresetProps) {
  const [presetSelecionado, setPresetSelecionado] = useState("");
  const adicionarAnimacaoElemento = useEditorStore((s) => s.adicionarAnimacaoElemento);
  const { presetsPersonalizados } = usePresetsAnimacao();
  const presetsDisponiveis = listarPresetsAnimacaoDisponiveis(presetsPersonalizados);
  const presetAtivo = presetsDisponiveis.find((preset) => preset.id === presetSelecionado);

  function aplicarPreset(id: string) {
    const preset = presetsDisponiveis.find((item) => item.id === id);
    if (!preset) return;
    for (const parcial of preset.animacoes) {
      const animacao: ElementAnimation = { ...parcial, id: `anim-${crypto.randomUUID()}`, elementId: elementoId };
      adicionarAnimacaoElemento(animacao);
    }
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-white/10 bg-slate-900/60 p-2.5">
      <div className="flex items-center gap-1.5">
        <Wand2 size={11} className="text-indigo-400" aria-hidden="true" />
        <label htmlFor={`preset-${elementoId}`} className="text-[10px] font-medium text-slate-400">
          Aplicar preset pronto
        </label>
      </div>
      <select
        id={`preset-${elementoId}`}
        value={presetSelecionado}
        onChange={(e) => {
          const id = e.target.value;
          setPresetSelecionado(id);
          if (id) aplicarPreset(id);
        }}
        className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
      >
        <option value="">Escolher preset...</option>
        {presetsDisponiveis.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.nome}{preset.origem === "personalizado" ? " — personalizado" : ""}
          </option>
        ))}
      </select>
      {presetAtivo && (
        <p className="text-[10px] text-slate-500">{presetAtivo.descricao}</p>
      )}
    </div>
  );
}
