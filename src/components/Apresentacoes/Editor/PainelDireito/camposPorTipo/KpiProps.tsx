import type { KpiComponente } from "@/lib/validations/slide-componentes";

export function KpiProps({ componente, onChange }: { componente: KpiComponente; onChange: (patch: Partial<KpiComponente>) => void }) {
  return (
    <>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Valor</label>
        <input type="text" value={componente.valor} onChange={(e) => onChange({ valor: e.target.value })} className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Label</label>
        <input type="text" value={componente.label} onChange={(e) => onChange({ label: e.target.value })} className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Variação (%, negativo para queda)</label>
        <input
          type="number"
          value={componente.variacao ?? ""}
          onChange={(e) => onChange({ variacao: e.target.value ? Number(e.target.value) : undefined })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
    </>
  );
}
