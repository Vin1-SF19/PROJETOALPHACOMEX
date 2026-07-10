import { Plus, Trash2 } from "lucide-react";
import type { GrafoComponente } from "@/lib/validations/slide-componentes";

/** Edição básica de nós/conexões — grafos complexos são mais fáceis de ajustar arrastando no próprio ReactFlow (futuro), por ora edição via lista simples. */
export function GrafoProps({ componente, onChange }: { componente: GrafoComponente; onChange: (patch: Partial<GrafoComponente>) => void }) {
  function atualizarNo(i: number, patch: Partial<GrafoComponente["nos"][number]>) {
    onChange({ nos: componente.nos.map((n, idx) => (idx === i ? { ...n, ...patch } : n)) });
  }
  function adicionarNo() {
    const id = `n${componente.nos.length + 1}`;
    onChange({ nos: [...componente.nos, { id, label: "Novo nó", x: 40, y: 40 }] });
  }
  function removerNo(i: number) {
    const noRemovido = componente.nos[i];
    onChange({
      nos: componente.nos.filter((_, idx) => idx !== i),
      conexoes: componente.conexoes.filter((c) => c.origem !== noRemovido.id && c.destino !== noRemovido.id),
    });
  }

  return (
    <>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Estilo</label>
        <select
          value={componente.estilo}
          onChange={(e) => onChange({ estilo: e.target.value as GrafoComponente["estilo"] })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        >
          <option value="fluxograma">Fluxograma</option>
          <option value="organograma">Organograma</option>
          <option value="mapamental">Mapa Mental</option>
        </select>
      </div>
      <div className="space-y-2 border-t border-white/5 pt-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] text-slate-400">Nós</label>
          <button type="button" onClick={adicionarNo} aria-label="Adicionar nó" className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-400">
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>
        {componente.nos.map((no, i) => (
          <div key={no.id} className="flex gap-1.5">
            <input
              type="text"
              value={no.label}
              onChange={(e) => atualizarNo(i, { label: e.target.value })}
              aria-label={`Label do nó ${i + 1}`}
              className="w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white outline-none focus:border-indigo-500"
            />
            <button type="button" onClick={() => removerNo(i)} aria-label={`Remover nó ${i + 1}`} className="cursor-pointer rounded-md p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-400">
              <Trash2 size={12} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
