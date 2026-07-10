import type { CardComponente } from "@/lib/validations/slide-componentes";

export function CardProps({ componente, onChange }: { componente: CardComponente; onChange: (patch: Partial<CardComponente>) => void }) {
  return (
    <>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Cor de fundo</label>
        <input
          type="color"
          value={componente.corFundo ?? "#0f172a"}
          onChange={(e) => onChange({ corFundo: e.target.value })}
          className="h-9 w-full rounded-lg border border-white/10 bg-slate-900"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-400">Borda arredondada</label>
          <input
            type="number"
            value={componente.borderRadius ?? 16}
            onChange={(e) => onChange({ borderRadius: Number(e.target.value) })}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-400">Espaçamento interno</label>
          <input
            type="number"
            value={componente.padding ?? 16}
            onChange={(e) => onChange({ padding: Number(e.target.value) })}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          />
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        {componente.filhos.length} componente{componente.filhos.length === 1 ? "" : "s"} dentro deste card.
      </p>
    </>
  );
}
