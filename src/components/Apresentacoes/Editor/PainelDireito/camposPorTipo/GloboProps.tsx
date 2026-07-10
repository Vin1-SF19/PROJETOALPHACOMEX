import { Plus, Trash2 } from "lucide-react";
import type { GloboComponente } from "@/lib/validations/slide-componentes";

export function GloboProps({ componente, onChange }: { componente: GloboComponente; onChange: (patch: Partial<GloboComponente>) => void }) {
  function adicionarMarcador() {
    onChange({ marcadores: [...componente.marcadores, { lat: 0, lng: 0, label: "", cor: "#f59e0b" }] });
  }

  function atualizarMarcador(index: number, patch: Partial<GloboComponente["marcadores"][number]>) {
    onChange({ marcadores: componente.marcadores.map((m, i) => (i === index ? { ...m, ...patch } : m)) });
  }

  function removerMarcador(index: number) {
    onChange({ marcadores: componente.marcadores.filter((_, i) => i !== index) });
  }

  return (
    <>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Cor base</label>
        <input
          type="text"
          value={componente.corBase ?? ""}
          onChange={(e) => onChange({ corBase: e.target.value })}
          placeholder="#4f46e5"
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">URL da textura</label>
        <input
          type="text"
          value={componente.texturaUrl ?? ""}
          onChange={(e) => onChange({ texturaUrl: e.target.value })}
          placeholder="https://..."
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Velocidade de rotação</label>
        <input
          type="number"
          min={0}
          max={5}
          step={0.1}
          value={componente.velocidadeRotacao}
          onChange={(e) => onChange({ velocidadeRotacao: Number(e.target.value) })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>

      <div className="space-y-2 border-t border-white/5 pt-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] text-slate-400">Marcadores</label>
          <button
            type="button"
            onClick={adicionarMarcador}
            aria-label="Adicionar marcador"
            className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-400"
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>
        {componente.marcadores.map((m, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-1.5 rounded-lg border border-white/5 p-2">
            <input
              type="number"
              value={m.lat}
              onChange={(e) => atualizarMarcador(i, { lat: Number(e.target.value) })}
              placeholder="Lat"
              aria-label={`Latitude do marcador ${i + 1}`}
              className="w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white outline-none focus:border-indigo-500"
            />
            <input
              type="number"
              value={m.lng}
              onChange={(e) => atualizarMarcador(i, { lng: Number(e.target.value) })}
              placeholder="Lng"
              aria-label={`Longitude do marcador ${i + 1}`}
              className="w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white outline-none focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={() => removerMarcador(i)}
              aria-label={`Remover marcador ${i + 1}`}
              className="cursor-pointer rounded-md p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
            >
              <Trash2 size={12} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
