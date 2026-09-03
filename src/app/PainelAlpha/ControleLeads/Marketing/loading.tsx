import { Loader2 } from "lucide-react";

export default function MarketingLoading() {
  return (
    <div role="status" aria-live="polite" className="grid min-h-screen place-items-center bg-slate-950 text-slate-300">
      <div className="flex items-center gap-3 text-sm font-bold">
        <Loader2 aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" />
        Carregando acompanhamento dos closers...
      </div>
    </div>
  );
}
