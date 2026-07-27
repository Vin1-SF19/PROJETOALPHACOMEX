"use client";

interface ItemChecklist {
  label: string;
  completo: boolean;
}

interface ProjectMaturityProps {
  itens: ItemChecklist[];
  accent: string;
}

export function ProjectMaturity({ itens, accent }: ProjectMaturityProps) {
  const completos = itens.filter((i) => i.completo).length;
  const percentual = itens.length ? Math.round((completos / itens.length) * 100) : 0;

  return (
    <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white">Maturidade da especificação</p>
        <span className="text-sm font-semibold" style={{ color: `rgb(${accent})` }}>{percentual}%</span>
      </div>

      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${percentual}%`, background: `rgb(${accent})` }} />
      </div>

      <ul className="space-y-1.5 pt-1">
        {itens.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-xs">
            <span
              className="w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border"
              style={item.completo ? { background: `rgba(${accent},0.2)`, borderColor: `rgba(${accent},0.4)` } : { borderColor: "rgba(255,255,255,0.15)" }}
            >
              {item.completo && (
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <path d="M1 4l2 2 4-4" stroke={`rgb(${accent})`} strokeWidth="1.5" />
                </svg>
              )}
            </span>
            <span className={item.completo ? "text-slate-300" : "text-slate-500"}>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
