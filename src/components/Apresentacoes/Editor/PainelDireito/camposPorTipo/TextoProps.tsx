import type { TextoComponente } from "@/lib/validations/slide-componentes";

export function TextoProps({ componente, onChange }: { componente: TextoComponente; onChange: (patch: Partial<TextoComponente>) => void }) {
  return (
    <>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Texto</label>
        <textarea
          value={componente.texto}
          onChange={(e) => onChange({ texto: e.target.value })}
          className="h-20 w-full resize-none rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Estilo</label>
        <select
          value={componente.tag}
          onChange={(e) => onChange({ tag: e.target.value as TextoComponente["tag"] })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        >
          <option value="h1">Título grande</option>
          <option value="h2">Título</option>
          <option value="p">Parágrafo</option>
          <option value="span">Texto simples</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-400">Cor</label>
          <input
            type="color"
            value={componente.corTexto ?? "#ffffff"}
            onChange={(e) => onChange({ corTexto: e.target.value })}
            className="h-9 w-full rounded-lg border border-white/10 bg-slate-900"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-400">Tamanho</label>
          <input
            type="number"
            value={componente.fontSize ?? 16}
            onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
          />
        </div>
      </div>
    </>
  );
}
