"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface AgendaAlphaErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export function AgendaAlphaError({ error, reset }: AgendaAlphaErrorProps) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <div role="alert" className="w-full max-w-lg rounded-[2.5rem] border border-rose-500/30 bg-slate-950/80 p-8 text-center shadow-2xl backdrop-blur-2xl">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10">
          <AlertTriangle className="size-6 text-rose-300" />
        </div>
        <h1 className="mt-5 text-lg font-black text-white">Não foi possível abrir a Agenda Alpha</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Seus eventos não foram alterados. Tente carregar novamente.
        </p>
        {error.digest && (
          <code className="mt-3 block text-xs text-slate-600">Identificador: {error.digest}</code>
        )}
        <Button type="button" onClick={reset} className="mt-6 gap-2">
          <RefreshCw className="size-4" /> Tentar novamente
        </Button>
      </div>
    </div>
  );
}

export default AgendaAlphaError;
