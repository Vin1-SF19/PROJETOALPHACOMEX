import type { IconeComponente } from "@/lib/validations/slide-componentes";

export function IconeProps({ componente, onChange }: { componente: IconeComponente; onChange: (patch: Partial<IconeComponente>) => void }) {
  return (
    <>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Nome do ícone (lucide-react)</label>
        <input
          type="text"
          value={componente.nomeIcone}
          onChange={(e) => onChange({ nomeIcone: e.target.value })}
          placeholder="Ex: Sparkles, Heart, Star"
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-400">Cor</label>
          <input
            type="color"
            value={componente.cor ?? "#4f46e5"}
            onChange={(e) => onChange({ cor: e.target.value })}
            className="h-9 w-full rounded-lg border border-white/10 bg-slate-900"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-400">Tamanho</label>
          <input
            type="number"
            value={componente.tamanhoIcone ?? 32}
            onChange={(e) => onChange({ tamanhoIcone: Number(e.target.value) })}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          />
        </div>
      </div>
    </>
  );
}
