import { Plus, Trash2 } from "lucide-react";
import type { ChecklistComponente } from "@/lib/validations/slide-componentes";

export function ChecklistProps({ componente, onChange }: { componente: ChecklistComponente; onChange: (patch: Partial<ChecklistComponente>) => void }) {
  function atualizarItem(i: number, patch: Partial<ChecklistComponente["itens"][number]>) {
    onChange({ itens: componente.itens.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  }
  function adicionar() {
    onChange({ itens: [...componente.itens, { texto: "Novo item", concluido: false }] });
  }
  function remover(i: number) {
    onChange({ itens: componente.itens.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-2 border-t border-white/5 pt-3">
      <div className="flex items-center justify-between">
        <label className="text-[11px] text-slate-400">Itens</label>
        <button type="button" onClick={adicionar} aria-label="Adicionar item" className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-400">
          <Plus size={14} aria-hidden="true" />
        </button>
      </div>
      {componente.itens.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input type="checkbox" checked={item.concluido} onChange={(e) => atualizarItem(i, { concluido: e.target.checked })} className="h-3.5 w-3.5 accent-indigo-500" />
          <input
            type="text"
            value={item.texto}
            onChange={(e) => atualizarItem(i, { texto: e.target.value })}
            aria-label={`Item ${i + 1}`}
            className="w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white outline-none focus:border-indigo-500"
          />
          <button type="button" onClick={() => remover(i)} aria-label={`Remover item ${i + 1}`} className="cursor-pointer rounded-md p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-400">
            <Trash2 size={12} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
