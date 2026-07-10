import { Plus, Trash2 } from "lucide-react";
import type { FaqComponente } from "@/lib/validations/slide-componentes";

export function FaqProps({ componente, onChange }: { componente: FaqComponente; onChange: (patch: Partial<FaqComponente>) => void }) {
  function atualizarItem(i: number, patch: Partial<FaqComponente["itens"][number]>) {
    onChange({ itens: componente.itens.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  }
  function adicionar() {
    onChange({ itens: [...componente.itens, { pergunta: "Pergunta?", resposta: "Resposta." }] });
  }
  function remover(i: number) {
    onChange({ itens: componente.itens.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-2 border-t border-white/5 pt-3">
      <div className="flex items-center justify-between">
        <label className="text-[11px] text-slate-400">Perguntas</label>
        <button type="button" onClick={adicionar} aria-label="Adicionar pergunta" className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-400">
          <Plus size={14} aria-hidden="true" />
        </button>
      </div>
      {componente.itens.map((item, i) => (
        <div key={i} className="space-y-1 rounded-lg border border-white/5 p-2">
          <div className="flex gap-1.5">
            <input
              type="text"
              value={item.pergunta}
              onChange={(e) => atualizarItem(i, { pergunta: e.target.value })}
              aria-label={`Pergunta ${i + 1}`}
              className="w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white outline-none focus:border-indigo-500"
            />
            <button type="button" onClick={() => remover(i)} aria-label={`Remover pergunta ${i + 1}`} className="cursor-pointer rounded-md p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-400">
              <Trash2 size={12} aria-hidden="true" />
            </button>
          </div>
          <textarea
            value={item.resposta}
            onChange={(e) => atualizarItem(i, { resposta: e.target.value })}
            aria-label={`Resposta ${i + 1}`}
            rows={2}
            className="w-full resize-none rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white outline-none focus:border-indigo-500"
          />
        </div>
      ))}
    </div>
  );
}
