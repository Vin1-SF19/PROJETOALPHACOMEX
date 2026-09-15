"use client";

import { useEffect, useState } from "react";

interface ProcessingProgressProps {
  active: boolean;
  steps: string[];
}

export function ProcessingProgress({ active, steps }: ProcessingProgressProps) {
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    if (!active) return;
    const intervalo = window.setInterval(() => {
      setIndice((atual) => Math.min(atual + 1, steps.length - 1));
    }, 850);
    return () => window.clearInterval(intervalo);
  }, [active, steps.length]);

  if (!active) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-indigo-400/20 bg-slate-950/70 p-4" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-100">{steps[indice]}</p>
          <p className="text-xs text-slate-400">Aguarde, estamos processando seus dados com segurança.</p>
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">{indice + 1}/{steps.length}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full rounded-full bg-gradient-to-r from-sky-500 via-violet-600 to-rose-500 transition-all duration-500 motion-reduce:transition-none" style={{ width: `${((indice + 1) / steps.length) * 100}%` }} />
      </div>
    </div>
  );
}
