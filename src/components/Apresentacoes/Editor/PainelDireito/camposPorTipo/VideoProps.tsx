import type { VideoComponente } from "@/lib/validations/slide-componentes";

export function VideoProps({ componente, onChange }: { componente: VideoComponente; onChange: (patch: Partial<VideoComponente>) => void }) {
  return (
    <>
      <div className="space-y-1.5">
        <label className="text-[11px] text-slate-400">URL do vídeo</label>
        <input
          type="text"
          value={componente.url}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder="https://..."
          className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
      </div>
      <div className="flex items-center justify-between">
        <label htmlFor="video-autoplay" className="text-[11px] text-slate-400">Autoplay</label>
        <input id="video-autoplay" type="checkbox" checked={componente.autoplay} onChange={(e) => onChange({ autoplay: e.target.checked })} className="h-4 w-4 accent-indigo-500" />
      </div>
      <div className="flex items-center justify-between">
        <label htmlFor="video-loop" className="text-[11px] text-slate-400">Loop</label>
        <input id="video-loop" type="checkbox" checked={componente.loop} onChange={(e) => onChange({ loop: e.target.checked })} className="h-4 w-4 accent-indigo-500" />
      </div>
      <div className="flex items-center justify-between">
        <label htmlFor="video-controles" className="text-[11px] text-slate-400">Mostrar controles</label>
        <input id="video-controles" type="checkbox" checked={componente.controles} onChange={(e) => onChange({ controles: e.target.checked })} className="h-4 w-4 accent-indigo-500" />
      </div>
      <div className="flex items-center justify-between">
        <label htmlFor="video-muted" className="text-[11px] text-slate-400">Mudo</label>
        <input id="video-muted" type="checkbox" checked={componente.muted} onChange={(e) => onChange({ muted: e.target.checked })} className="h-4 w-4 accent-indigo-500" />
      </div>
    </>
  );
}
