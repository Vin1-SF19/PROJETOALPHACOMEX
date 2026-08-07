import { useState } from "react";
import { Wand2 } from "lucide-react";
import { useEditorStore } from "../../store/useEditorStore";
import { PRESETS_ANIMACAO_COMPLETOS, type PresetAnimacaoCompletoId } from "@/lib/apresentacoes/animacao/presets-completos";
import type { ElementAnimation } from "@/lib/apresentacoes/animacao/tipos";

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
  const [presetSelecionado, setPresetSelecionado] = useState<PresetAnimacaoCompletoId | "">("");
  const adicionarAnimacaoElemento = useEditorStore((s) => s.adicionarAnimacaoElemento);

  function aplicarPreset(id: PresetAnimacaoCompletoId) {
    const parciais = PRESETS_ANIMACAO_COMPLETOS[id].criar();
    for (const parcial of parciais) {
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
          const id = e.target.value as PresetAnimacaoCompletoId | "";
          setPresetSelecionado(id);
          if (id) aplicarPreset(id);
        }}
        className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
      >
        <option value="">Escolher preset...</option>
        {Object.entries(PRESETS_ANIMACAO_COMPLETOS).map(([id, preset]) => (
          <option key={id} value={id}>
            {preset.nome}
          </option>
        ))}
      </select>
      {presetSelecionado && (
        <p className="text-[10px] text-slate-500">{PRESETS_ANIMACAO_COMPLETOS[presetSelecionado].descricao}</p>
      )}
    </div>
  );
}
