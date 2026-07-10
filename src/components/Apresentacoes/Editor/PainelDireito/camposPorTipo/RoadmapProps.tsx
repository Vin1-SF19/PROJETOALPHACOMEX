import { Plus, Trash2 } from "lucide-react";
import type { RoadmapComponente } from "@/lib/validations/slide-componentes";

export function RoadmapProps({ componente, onChange }: { componente: RoadmapComponente; onChange: (patch: Partial<RoadmapComponente>) => void }) {
  function atualizarItem(i: number, patch: Partial<RoadmapComponente["itens"][number]>) {
    onChange({ itens: componente.itens.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  }
  function adicionar() {
    onChange({ itens: [...componente.itens, { titulo: "Nova etapa", concluido: false }] });
  }
  function remover(i: number) {
    onChange({ itens: componente.itens.filter((_, idx) => idx !== i) });
  }

  return (
    <>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Orientação</label>
        <select
          value={componente.orientacao}
          onChange={(e) => onChange({ orientacao: e.target.value as RoadmapComponente["orientacao"] })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        >
          <option value="horizontal">Horizontal</option>
          <option value="vertical">Vertical</option>
        </select>
      </div>
      <div className="space-y-2 border-t border-white/5 pt-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] text-slate-400">Etapas</label>
          <button type="button" onClick={adicionar} aria-label="Adicionar etapa" className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-400">
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>
        {componente.itens.map((item, i) => (
          <div key={i} className="space-y-1 rounded-lg border border-white/5 p-2">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={item.titulo}
                onChange={(e) => atualizarItem(i, { titulo: e.target.value })}
                aria-label={`Título da etapa ${i + 1}`}
                className="w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white outline-none focus:border-indigo-500"
              />
              <button type="button" onClick={() => remover(i)} aria-label={`Remover etapa ${i + 1}`} className="cursor-pointer rounded-md p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-400">
                <Trash2 size={12} aria-hidden="true" />
              </button>
            </div>
            <label className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <input type="checkbox" checked={item.concluido ?? false} onChange={(e) => atualizarItem(i, { concluido: e.target.checked })} className="h-3 w-3 accent-indigo-500" />
              Concluído
            </label>
          </div>
        ))}
      </div>
    </>
  );
}
