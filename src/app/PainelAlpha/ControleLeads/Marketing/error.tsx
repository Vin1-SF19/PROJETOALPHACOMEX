"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MarketingErrorProps {
  reset: () => void;
}

export default function MarketingError({ reset }: MarketingErrorProps) {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 p-6 text-center text-white">
      <div role="alert" className="max-w-md rounded-[2rem] border border-rose-500/30 bg-slate-900/60 p-8">
        <AlertTriangle aria-hidden="true" className="mx-auto size-8 text-rose-400" />
        <h1 className="mt-4 text-lg font-black">Não foi possível carregar o acompanhamento</h1>
        <p className="mt-2 text-sm text-slate-400">Os dados não foram alterados. Tente carregar novamente.</p>
        <Button type="button" onClick={reset} className="mt-6 gap-2">
          <RefreshCw aria-hidden="true" className="size-4" /> Tentar novamente
        </Button>
      </div>
    </div>
  );
}
