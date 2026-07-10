import type { DivisorComponente } from "@/lib/validations/slide-componentes";

export function DivisorProps({ componente, onChange }: { componente: DivisorComponente; onChange: (patch: Partial<DivisorComponente>) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Cor</label>
        <input
          type="color"
          value={componente.cor ?? "#ffffff"}
          onChange={(e) => onChange({ cor: e.target.value })}
          className="h-9 w-full rounded-lg border border-white/10 bg-slate-900"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Espessura</label>
        <input
          type="number"
          value={componente.espessura ?? 2}
          onChange={(e) => onChange({ espessura: Number(e.target.value) })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
    </div>
  );
}
