import type { AudioComponente } from "@/lib/validations/slide-componentes";

interface AudioPropsProps {
  componente: AudioComponente;
  onChange: (patch: Partial<AudioComponente>) => void;
}

export function AudioProps({ componente, onChange }: AudioPropsProps) {
  return (
    <>
      <div className="space-y-1.5">
        <label htmlFor="audio-titulo" className="text-[11px] text-slate-400">Título</label>
        <input id="audio-titulo" value={componente.titulo} onChange={(event) => onChange({ titulo: event.target.value })} className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="audio-url" className="text-[11px] text-slate-400">URL do áudio</label>
        <input id="audio-url" value={componente.url} onChange={(event) => onChange({ url: event.target.value })} placeholder="https://..." className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500" />
      </div>
      <label className="flex items-center justify-between text-[11px] text-slate-400">
        Autoplay
        <input type="checkbox" checked={componente.autoplay} onChange={(event) => onChange({ autoplay: event.target.checked })} className="h-4 w-4 accent-indigo-500" />
      </label>
      <label className="flex items-center justify-between text-[11px] text-slate-400">
        Repetir
        <input type="checkbox" checked={componente.loop} onChange={(event) => onChange({ loop: event.target.checked })} className="h-4 w-4 accent-indigo-500" />
      </label>
      <label className="flex items-center justify-between text-[11px] text-slate-400">
        Mostrar controles
        <input type="checkbox" checked={componente.controles} onChange={(event) => onChange({ controles: event.target.checked })} className="h-4 w-4 accent-indigo-500" />
      </label>
    </>
  );
}
