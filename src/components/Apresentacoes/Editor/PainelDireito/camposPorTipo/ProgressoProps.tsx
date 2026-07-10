import type { ProgressoComponente } from "@/lib/validations/slide-componentes";

export function ProgressoProps({ componente, onChange }: { componente: ProgressoComponente; onChange: (patch: Partial<ProgressoComponente>) => void }) {
  return (
    <>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Percentual</label>
        <input
          type="number"
          min={0}
          max={100}
          value={componente.percentual}
          onChange={(e) => onChange({ percentual: Number(e.target.value) })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Label</label>
        <input type="text" value={componente.label ?? ""} onChange={(e) => onChange({ label: e.target.value })} className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Cor</label>
        <input type="text" value={componente.cor ?? ""} onChange={(e) => onChange({ cor: e.target.value })} placeholder="#4f46e5" className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" />
      </div>
    </>
  );
}
