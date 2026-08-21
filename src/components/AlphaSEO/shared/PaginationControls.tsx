"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  page: number;
  pageSize: number;
  totalCount: number | null;
  hasMore: boolean;
  pending: boolean;
  onPageChange: (page: number) => void;
}

export function PaginationControls({
  page,
  pageSize,
  totalCount,
  hasMore,
  pending,
  onPageChange,
}: PaginationControlsProps) {
  const first = (page - 1) * pageSize + 1;
  const last = totalCount == null
    ? page * pageSize
    : Math.min(page * pageSize, totalCount);
  const pages = totalCount == null ? null : Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <nav aria-label="Paginação dos resultados" className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-4 py-3">
      <p className="text-xs tabular-nums text-slate-500">
        {totalCount == null
          ? `Página ${page} · registros ${first}–${last}`
          : `${first}–${last} de ${totalCount.toLocaleString("pt-BR")} · página ${page} de ${pages}`}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          aria-label="Ir para a página anterior"
          onClick={() => onPageChange(page - 1)}
          disabled={pending || page <= 1}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-bold text-slate-300 disabled:opacity-40"
        >
          <ChevronLeft size={14} aria-hidden="true" /> Anterior
        </button>
        <button
          type="button"
          aria-label="Ir para a próxima página"
          onClick={() => onPageChange(page + 1)}
          disabled={pending || !hasMore}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-bold text-slate-300 disabled:opacity-40"
        >
          Próxima <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
