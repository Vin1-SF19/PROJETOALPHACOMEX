import type { FormaComponente } from "@/lib/validations/slide-componentes";
import { FORMAS_CATALOGO } from "@/lib/apresentacoes/formas-catalogo";
import { ColorField } from "./ColorField";

const inputClass = "w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500";

export function FormaProps({ componente, onChange }: { componente: FormaComponente; onChange: (patch: Partial<FormaComponente>) => void }) {
  return (
    <>
      <div className="rounded-lg border border-white/5 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-500">
        Forma: <span className="font-semibold text-slate-300">{FORMAS_CATALOGO[componente.variante].label}</span>
      </div>

      <ColorField
        id="forma-cor-preenchimento"
        label="Cor de preenchimento"
        value={componente.corPreenchimento ?? "#4f46e5"}
        fallback="#4f46e5"
        onChange={(corPreenchimento) => onChange({ corPreenchimento })}
      />

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1.5">
          <span className="text-[11px] text-slate-400">Espessura da borda</span>
          <input
            type="number"
            min={0}
            max={40}
            step={1}
            value={componente.larguraBorda ?? 0}
            onChange={(e) => onChange({ larguraBorda: Math.max(0, Number(e.target.value)) })}
            className={inputClass}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-[11px] text-slate-400">Cor da borda</span>
          <input
            type="color"
            value={componente.corBorda ?? "#ffffff"}
            onChange={(e) => onChange({ corBorda: e.target.value })}
            disabled={!componente.larguraBorda}
            className="h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
          />
        </label>
      </div>
    </>
  );
}
