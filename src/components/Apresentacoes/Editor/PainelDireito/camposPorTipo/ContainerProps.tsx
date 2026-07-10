import type { ContainerComponente } from "@/lib/validations/slide-componentes";

export function ContainerProps({ componente, onChange }: { componente: ContainerComponente; onChange: (patch: Partial<ContainerComponente>) => void }) {
  return (
    <>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Layout</label>
        <select
          value={componente.layout}
          onChange={(e) => onChange({ layout: e.target.value as ContainerComponente["layout"] })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        >
          <option value="flex-col">Coluna (vertical)</option>
          <option value="flex-row">Linha (horizontal)</option>
          <option value="grid">Grid</option>
          <option value="stack">Empilhado (posições livres)</option>
        </select>
      </div>
      {componente.layout === "grid" && (
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-400">Colunas</label>
          <input
            type="number"
            min={1}
            value={componente.colunas ?? 2}
            onChange={(e) => onChange({ colunas: Number(e.target.value) })}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          />
        </div>
      )}
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Espaçamento</label>
        <input
          type="number"
          min={0}
          value={componente.gap ?? 0}
          onChange={(e) => onChange({ gap: Number(e.target.value) })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Cor de fundo</label>
        <input
          type="text"
          value={componente.corFundo ?? ""}
          onChange={(e) => onChange({ corFundo: e.target.value })}
          placeholder="#0f172a"
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
    </>
  );
}
