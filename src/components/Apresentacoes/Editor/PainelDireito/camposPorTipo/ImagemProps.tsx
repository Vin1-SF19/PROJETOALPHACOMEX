import type { ImagemComponente } from "@/lib/validations/slide-componentes";

export function ImagemProps({ componente, onChange }: { componente: ImagemComponente; onChange: (patch: Partial<ImagemComponente>) => void }) {
  return (
    <>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">URL da imagem</label>
        <input
          type="text"
          value={componente.url}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder="https://..."
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Texto alternativo</label>
        <input
          type="text"
          value={componente.alt ?? ""}
          onChange={(e) => onChange({ alt: e.target.value })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">Ajuste</label>
        <select
          value={componente.objectFit ?? "cover"}
          onChange={(e) => onChange({ objectFit: e.target.value as ImagemComponente["objectFit"] })}
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        >
          <option value="cover">Preencher (cover)</option>
          <option value="contain">Ajustar (contain)</option>
        </select>
      </div>
    </>
  );
}
