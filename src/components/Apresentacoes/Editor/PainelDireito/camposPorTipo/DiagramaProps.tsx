import { Plus, Trash2 } from "lucide-react";
import type { DiagramaComponente } from "@/lib/validations/slide-componentes";

export function DiagramaProps({ componente, onChange }: { componente: DiagramaComponente; onChange: (patch: Partial<DiagramaComponente>) => void }) {
  function atualizarItem(i: number, patch: Partial<DiagramaComponente["itens"][number]>) {
    onChange({ itens: componente.itens.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  }
  function adicionar() {
    onChange({ itens: [...componente.itens, { label: "Novo item" }] });
  }
  function remover(i: number) {
    onChange({ itens: componente.itens.filter((_, idx) => idx !== i) });
  }

  return (
    <>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Formato</label>
        <select
          value={componente.formato}
          onChange={(e) => onChange({ formato: e.target.value as DiagramaComponente["formato"] })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        >
          <option value="swot">SWOT</option>
          <option value="matriz2x2">Matriz 2x2</option>
          <option value="piramide">Pirâmide</option>
          <option value="funil">Funil</option>
        </select>
      </div>
      <div className="space-y-2 border-t border-white/5 pt-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] text-slate-400">Itens</label>
          <button type="button" onClick={adicionar} aria-label="Adicionar item" className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-400">
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>
        {componente.itens.map((item, i) => (
          <div key={i} className="flex gap-1.5">
            <input
              type="text"
              value={item.label}
              onChange={(e) => atualizarItem(i, { label: e.target.value })}
              aria-label={`Label do item ${i + 1}`}
              className="w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              value={item.cor ?? ""}
              onChange={(e) => atualizarItem(i, { cor: e.target.value })}
              placeholder="cor"
              aria-label={`Cor do item ${i + 1}`}
              className="w-20 rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white outline-none focus:border-indigo-500"
            />
            <button type="button" onClick={() => remover(i)} aria-label={`Remover item ${i + 1}`} className="cursor-pointer rounded-md p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-400">
              <Trash2 size={12} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
