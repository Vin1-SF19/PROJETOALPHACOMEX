import { Plus, Trash2 } from "lucide-react";
import type { GraficoComponente } from "@/lib/validations/slide-componentes";

export function GraficoProps({ componente, onChange }: { componente: GraficoComponente; onChange: (patch: Partial<GraficoComponente>) => void }) {
  function atualizarPonto(i: number, patch: Partial<{ label: string; valor: number }>) {
    onChange({ dados: componente.dados.map((d, idx) => (idx === i ? { ...d, ...patch } : d)) });
  }
  function adicionarPonto() {
    onChange({ dados: [...componente.dados, { label: "Novo", valor: 0 }] });
  }
  function removerPonto(i: number) {
    onChange({ dados: componente.dados.filter((_, idx) => idx !== i) });
  }

  return (
    <>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Tipo de gráfico</label>
        <select
          value={componente.tipoGrafico}
          onChange={(e) => onChange({ tipoGrafico: e.target.value as GraficoComponente["tipoGrafico"] })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        >
          <option value="barra">Barra</option>
          <option value="linha">Linha</option>
          <option value="pizza">Pizza</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Cor primária</label>
        <input
          type="text"
          value={componente.corPrimaria ?? ""}
          onChange={(e) => onChange({ corPrimaria: e.target.value })}
          placeholder="#4f46e5"
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
      <div className="space-y-2 border-t border-white/5 pt-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] text-slate-400">Dados</label>
          <button type="button" onClick={adicionarPonto} aria-label="Adicionar ponto" className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-400">
            <Plus size={14} aria-hidden="true" />
          </button>
        </div>
        {componente.dados.map((d, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
            <input
              type="text"
              value={d.label}
              onChange={(e) => atualizarPonto(i, { label: e.target.value })}
              aria-label={`Label do ponto ${i + 1}`}
              className="w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white outline-none focus:border-indigo-500"
            />
            <input
              type="number"
              value={d.valor}
              onChange={(e) => atualizarPonto(i, { valor: Number(e.target.value) })}
              aria-label={`Valor do ponto ${i + 1}`}
              className="w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white outline-none focus:border-indigo-500"
            />
            <button type="button" onClick={() => removerPonto(i)} aria-label={`Remover ponto ${i + 1}`} className="cursor-pointer rounded-md p-1 text-slate-500 hover:bg-red-500/10 hover:text-red-400">
              <Trash2 size={12} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
