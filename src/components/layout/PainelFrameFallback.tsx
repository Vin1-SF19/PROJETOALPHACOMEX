'use client';

import { LoaderCircle, RefreshCw } from 'lucide-react';

interface PainelFrameFallbackProps {
  isError: boolean;
  moduleLabel: string;
  onRetry: () => void;
}

export function PainelFrameFallback({
  isError,
  moduleLabel,
  onRetry,
}: PainelFrameFallbackProps) {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-[#020617] px-6"
      role={isError ? 'alert' : 'status'}
      aria-live="polite"
      aria-busy={!isError}
    >
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        {isError ? (
          <>
            <div className="flex size-10 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
              <RefreshCw className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-100">O módulo demorou para responder</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Não foi possível confirmar o carregamento de {moduleLabel}.
              </p>
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm font-medium text-slate-100 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Tentar novamente
            </button>
          </>
        ) : (
          <>
            <LoaderCircle className="size-7 text-blue-400 motion-safe:animate-spin" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-slate-200">Carregando {moduleLabel}</p>
              <p className="mt-1 text-xs text-slate-500">Preparando o ambiente do módulo…</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
