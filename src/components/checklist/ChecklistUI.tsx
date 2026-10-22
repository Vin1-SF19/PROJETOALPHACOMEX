"use client";
import type { ComponentProps } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
export const campoChecklist =
  "w-full rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-[var(--checklist-accent)] disabled:opacity-60";
export function Acao({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--checklist-accent)] disabled:cursor-not-allowed disabled:opacity-45",
        className,
      )}
    />
  );
}
export function Carregando() {
  return (
    <div role="status" className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-slate-300">
      <Loader2 className="animate-spin" size={18} />
      Carregando checklist…
    </div>
  );
}
export function Falha({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-rose-400/30 bg-rose-950/30 p-5 text-sm text-rose-200">
      <p>{error instanceof Error ? error.message : String(error)}</p>
      {retry && (
        <Acao onClick={retry} className="mt-3">
          <RefreshCw size={14} />
          Tentar novamente
        </Acao>
      )}
    </div>
  );
}
export function Paginas({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm text-slate-400">
      <span>
        {total} registro(s) · Página {page} de {Math.max(1, Math.ceil(total / pageSize))}
      </span>
      <div className="flex gap-2">
        <Acao disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Anterior
        </Acao>
        <Acao disabled={page * pageSize >= total} onClick={() => onPage(page + 1)}>
          Próxima
        </Acao>
      </div>
    </nav>
  );
}
export function Percentual({ percentual, descricao }: { percentual: number; descricao: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-slate-300">
        <span>{descricao}</span>
        <strong>{percentual}%</strong>
      </div>
      <div
        role="progressbar"
        aria-label="Progresso documental"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentual}
        className="h-1.5 overflow-hidden rounded-full bg-white/10"
      >
        <div className="h-full rounded-full bg-[var(--checklist-accent)] transition-all duration-300" style={{ width: `${percentual}%` }} />
      </div>
    </div>
  );
}
