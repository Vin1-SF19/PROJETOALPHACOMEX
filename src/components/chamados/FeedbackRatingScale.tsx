"use client";

interface FeedbackRatingScaleProps {
  id: string;
  label: string;
  lowLabel: string;
  highLabel: string;
  value?: number;
  onChange: (value: number) => void;
  error?: string;
  accent: string;
}

const NOTAS = [0, 1, 2, 3, 4, 5] as const;

export function FeedbackRatingScale({
  id,
  label,
  lowLabel,
  highLabel,
  value,
  onChange,
  error,
  accent,
}: FeedbackRatingScaleProps) {
  const errorId = `${id}-erro`;
  const helpId = `${id}-ajuda`;

  return (
    <fieldset aria-describedby={`${helpId}${error ? ` ${errorId}` : ""}`} className="space-y-3">
      <legend className="text-sm font-bold leading-relaxed text-slate-100">{label}</legend>
      <div className="grid grid-cols-6 gap-1.5 sm:gap-2" role="radiogroup" aria-label={label}>
        {NOTAS.map((nota) => {
          const checked = value === nota;
          return (
            <label key={nota} className="cursor-pointer">
              <input
                type="radio"
                name={id}
                value={nota}
                checked={checked}
                onChange={() => onChange(nota)}
                className="peer sr-only"
              />
              <span
                className="flex h-11 items-center justify-center rounded-xl border border-white/10 bg-slate-950/70 text-sm font-black text-slate-400 transition-all hover:border-white/25 hover:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-slate-950"
                style={checked ? {
                  borderColor: `rgba(${accent}, 0.85)`,
                  backgroundColor: `rgba(${accent}, 0.24)`,
                  color: "rgb(255, 255, 255)",
                  boxShadow: `0 0 18px rgba(${accent}, 0.18)`,
                } : undefined}
              >
                {nota}
              </span>
            </label>
          );
        })}
      </div>
      <div id={helpId} className="flex items-start justify-between gap-4 text-[10px] font-medium leading-snug text-slate-500">
        <span>0 — {lowLabel}</span>
        <span className="text-right">5 — {highLabel}</span>
      </div>
      {error && <p id={errorId} role="alert" className="text-xs font-medium text-rose-300">{error}</p>}
    </fieldset>
  );
}
