import type { ParticulasComponente } from "@/lib/validations/slide-componentes";

export function ParticulasProps({ componente, onChange }: { componente: ParticulasComponente; onChange: (patch: Partial<ParticulasComponente>) => void }) {
  return (
    <>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Quantidade</label>
        <input
          type="number"
          min={10}
          max={2000}
          value={componente.quantidade}
          onChange={(e) => onChange({ quantidade: Number(e.target.value) })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Cor</label>
        <input
          type="text"
          value={componente.cor ?? ""}
          onChange={(e) => onChange({ cor: e.target.value })}
          placeholder="#818cf8"
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Tamanho</label>
        <input
          type="number"
          min={0.5}
          max={10}
          step={0.5}
          value={componente.tamanho}
          onChange={(e) => onChange({ tamanho: Number(e.target.value) })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Velocidade</label>
        <input
          type="number"
          min={0}
          max={5}
          step={0.1}
          value={componente.velocidade}
          onChange={(e) => onChange({ velocidade: Number(e.target.value) })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
    </>
  );
}
