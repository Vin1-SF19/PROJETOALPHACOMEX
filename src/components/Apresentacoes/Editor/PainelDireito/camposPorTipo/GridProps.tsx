import type { GridComponente } from "@/lib/validations/slide-componentes";

export function GridProps({ componente, onChange }: { componente: GridComponente; onChange: (patch: Partial<GridComponente>) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-400">Colunas</label>
          <input
            type="number"
            min={1}
            value={componente.colunas}
            onChange={(e) => onChange({ colunas: Math.max(1, Number(e.target.value)) })}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-400">Espaçamento</label>
          <input
            type="number"
            value={componente.gap ?? 12}
            onChange={(e) => onChange({ gap: Number(e.target.value) })}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          />
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        {componente.filhos.length} componente{componente.filhos.length === 1 ? "" : "s"} dentro deste grid.
      </p>
    </>
  );
}
