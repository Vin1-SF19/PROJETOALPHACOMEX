import { CalendarDays } from "lucide-react";

export default function AgendaAlphaLoading() {
  return (
    <div className="mx-auto max-w-[1800px] px-3 py-4 sm:px-6 lg:px-8" role="status" aria-busy="true">
      <span className="sr-only">Carregando Agenda Alpha</span>
      <div className="mb-4 flex items-center gap-3 rounded-[2rem] border border-white/10 bg-slate-950/55 p-4 backdrop-blur-2xl">
        <div className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
          <CalendarDays className="size-5 text-slate-400" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="h-2.5 w-24 animate-pulse rounded-full bg-white/10 motion-reduce:animate-none" />
          <div className="h-4 w-52 animate-pulse rounded-full bg-white/10 motion-reduce:animate-none" />
        </div>
      </div>
      <div className="flex gap-4">
        <div className="hidden w-72 shrink-0 space-y-4 rounded-[2rem] border border-white/10 bg-slate-950/55 p-4 lg:block">
          <div className="h-11 animate-pulse rounded-xl bg-white/10 motion-reduce:animate-none" />
          <div className="h-56 animate-pulse rounded-2xl bg-white/5 motion-reduce:animate-none" />
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, indice) => (
              <div key={indice} className="h-10 animate-pulse rounded-xl bg-white/5 motion-reduce:animate-none" />
            ))}
          </div>
        </div>
        <div className="min-h-[65vh] min-w-0 flex-1 animate-pulse rounded-[2rem] border border-white/5 bg-white/[0.025] motion-reduce:animate-none" />
      </div>
    </div>
  );
}
