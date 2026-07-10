import type { BotaoComponente } from "@/lib/validations/slide-componentes";

export function BotaoProps({ componente, onChange }: { componente: BotaoComponente; onChange: (patch: Partial<BotaoComponente>) => void }) {
  return (
    <>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Texto do botão</label>
        <input
          type="text"
          value={componente.texto}
          onChange={(e) => onChange({ texto: e.target.value })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-400">Fundo</label>
          <input
            type="color"
            value={componente.corFundo ?? "#4f46e5"}
            onChange={(e) => onChange({ corFundo: e.target.value })}
            className="h-9 w-full rounded-lg border border-white/10 bg-slate-900"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-400">Texto</label>
          <input
            type="color"
            value={componente.corTexto ?? "#ffffff"}
            onChange={(e) => onChange({ corTexto: e.target.value })}
            className="h-9 w-full rounded-lg border border-white/10 bg-slate-900"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Borda arredondada</label>
        <input
          type="number"
          value={componente.borderRadius ?? 12}
          onChange={(e) => onChange({ borderRadius: Number(e.target.value) })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Link (opcional)</label>
        <input
          type="text"
          value={componente.href ?? ""}
          onChange={(e) => onChange({ href: e.target.value })}
          placeholder="https://..."
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
    </>
  );
}
