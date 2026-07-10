import { Plus, Trash2 } from "lucide-react";
import type { ComparacaoComponente } from "@/lib/validations/slide-componentes";

export function ComparacaoProps({ componente, onChange }: { componente: ComparacaoComponente; onChange: (patch: Partial<ComparacaoComponente>) => void }) {
  function atualizarColuna(i: number, patch: Partial<ComparacaoComponente["colunas"][number]>) {
    onChange({ colunas: componente.colunas.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });
  }
  function adicionar() {
    onChange({ colunas: [...componente.colunas, { titulo: "Nova coluna", itens: [], destaque: false }] });
  }
  function remover(i: number) {
    onChange({ colunas: componente.colunas.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-2 border-t border-white/5 pt-3">
      <div className="flex items-center justify-between">
        <label className="text-[11px] text-slate-400">Colunas</label>
        <button type="button" onClick={adicionar} aria-label="Adicionar coluna" className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-400">
          <Plus size={14} aria-hidden="true" />
        </button>
      </div>
      {componente.colunas.map((col, i) => (
        <div key={i} className="space-y-1 rounded-lg border border-white/5 p-2">
          <div className="flex gap-1.5">
            <input
              type="text"
              value={col.titulo}
              onChange={(e) => atualizarColuna(i, { titulo: e.target.value })}
              aria-label={`Título da coluna ${i + 1}`}
              className="w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white outline-none focus:border-indigo-500"
            />
            <button type="button" onClick={() => remover(i)} aria-label={`Remover coluna ${i + 1}`} className="cursor-pointer rounded-md p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-400">
              <Trash2 size={12} aria-hidden="true" />
            </button>
          </div>
          <textarea
            value={col.itens.join("\n")}
            onChange={(e) => atualizarColuna(i, { itens: e.target.value.split("\n").filter(Boolean) })}
            placeholder="1 item por linha"
            rows={3}
            className="w-full resize-none rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white outline-none focus:border-indigo-500"
          />
          <label className="flex items-center gap-1.5 text-[10px] text-slate-400">
            <input type="checkbox" checked={col.destaque ?? false} onChange={(e) => atualizarColuna(i, { destaque: e.target.checked })} className="h-3 w-3 accent-indigo-500" />
            Destacar
          </label>
        </div>
      ))}
    </div>
  );
}
