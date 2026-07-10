import type { Objeto3dComponente } from "@/lib/validations/slide-componentes";

export function ObjetoGlbProps({ componente, onChange }: { componente: Objeto3dComponente; onChange: (patch: Partial<Objeto3dComponente>) => void }) {
  return (
    <>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">URL do modelo (.glb/.gltf)</label>
        <input
          type="text"
          value={componente.url}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder="https://..."
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
      <div className="flex items-center justify-between">
        <label htmlFor="objeto3d-auto-rotacao" className="text-[11px] text-slate-400">
          Rotação automática
        </label>
        <input
          id="objeto3d-auto-rotacao"
          type="checkbox"
          checked={componente.autoRotacao}
          onChange={(e) => onChange({ autoRotacao: e.target.checked })}
          className="h-4 w-4 accent-indigo-500"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Escala</label>
        <input
          type="number"
          min={0.1}
          max={10}
          step={0.1}
          value={componente.escala}
          onChange={(e) => onChange({ escala: Number(e.target.value) })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
    </>
  );
}
