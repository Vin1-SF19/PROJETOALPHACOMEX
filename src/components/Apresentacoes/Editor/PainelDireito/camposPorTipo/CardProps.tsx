import type { CardComponente } from "@/lib/validations/slide-componentes";
import { ColorField } from "./ColorField";

export function CardProps({ componente, onChange }: { componente: CardComponente; onChange: (patch: Partial<CardComponente>) => void }) {
  const usaGradiente = Boolean(componente.gradiente);

  return (
    <>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400">Fundo</span>
          <div className="flex rounded-lg border border-white/10 p-0.5" role="group" aria-label="Tipo de fundo">
            <button
              type="button"
              onClick={() => onChange({ gradiente: undefined })}
              aria-pressed={!usaGradiente}
              className={`rounded-md px-2.5 py-1 text-[10px] font-medium ${!usaGradiente ? "bg-indigo-500/20 text-indigo-200" : "text-slate-500 hover:text-white"}`}
            >
              Sólida
            </button>
            <button
              type="button"
              onClick={() => onChange({ gradiente: componente.gradiente ?? { angulo: 135, corInicio: componente.corFundo ?? "#4f46e5", corFim: "#0ea5e9" } })}
              aria-pressed={usaGradiente}
              className={`rounded-md px-2.5 py-1 text-[10px] font-medium ${usaGradiente ? "bg-indigo-500/20 text-indigo-200" : "text-slate-500 hover:text-white"}`}
            >
              Gradiente
            </button>
          </div>
        </div>

        {usaGradiente ? (
          <div className="space-y-2 rounded-lg border border-white/10 bg-slate-900/40 p-2.5">
            <ColorField
              id="card-gradiente-inicio"
              label="Cor inicial"
              value={componente.gradiente?.corInicio ?? "#4f46e5"}
              fallback="#4f46e5"
              onChange={(corInicio) => onChange({ gradiente: { ...componente.gradiente!, corInicio } })}
            />
            <ColorField
              id="card-gradiente-fim"
              label="Cor final"
              value={componente.gradiente?.corFim ?? "#0ea5e9"}
              fallback="#0ea5e9"
              onChange={(corFim) => onChange({ gradiente: { ...componente.gradiente!, corFim } })}
            />
            <label className="space-y-1">
              <span className="text-[10px] text-slate-500">Ângulo: {componente.gradiente?.angulo ?? 135}°</span>
              <input
                type="range"
                min={0}
                max={360}
                value={componente.gradiente?.angulo ?? 135}
                onChange={(e) => onChange({ gradiente: { ...componente.gradiente!, angulo: Number(e.target.value) } })}
                className="w-full accent-indigo-500"
              />
            </label>
          </div>
        ) : (
          <ColorField id="card-cor-fundo" label="Cor de fundo" value={componente.corFundo ?? "#0f172a"} fallback="#0f172a" onChange={(corFundo) => onChange({ corFundo })} />
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-400">Borda arredondada</label>
          <input
            type="number"
            value={componente.borderRadius ?? 16}
            onChange={(e) => onChange({ borderRadius: Number(e.target.value) })}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-400">Espaçamento interno</label>
          <input
            type="number"
            value={componente.padding ?? 16}
            onChange={(e) => onChange({ padding: Number(e.target.value) })}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          />
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        {componente.filhos.length} componente{componente.filhos.length === 1 ? "" : "s"} dentro deste card.
      </p>
    </>
  );
}
