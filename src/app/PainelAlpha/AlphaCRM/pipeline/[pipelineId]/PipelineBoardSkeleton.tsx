"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";

/**
 * SkeletonCard — placeholder com shimmer que ocupa as mesmas dimensões
 * de um PipelineCard real (~72px de altura mínima), evitando CLS.
 * aria-hidden: não é conteúdo semântico.
 */
export const SkeletonCard = memo(function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "alpha-skeleton h-[72px] w-full rounded-lg",
        className,
      )}
    />
  );
});

/**
 * SkeletonColumn — coluna placeholder com header + 3–5 SkeletonCards.
 * Contagem simulada por setor (metadados conhecidos do pipeline).
 */
export const SkeletonColumn = memo(function SkeletonColumn({
  cardCount = 4,
  className,
}: {
  cardCount?: number;
  className?: string;
}) {
  const cards = Array.from({ length: Math.min(Math.max(cardCount, 3), 5) });

  return (
    <div
      aria-hidden="true"
      className={cn(
        "alpha-pipeline-column-shell flex flex-col min-w-[240px] max-w-[240px]",
        className,
      )}
    >
      {/* Header placeholder */}
      <div className="alpha-pipeline-column-header mb-2 px-1 py-1">
        <div className="alpha-skeleton h-5 w-[60%] rounded-md" />
      </div>
      {/* Cards empilhados */}
      <div className="flex-1 flex flex-col gap-2 p-2 min-h-[60px]">
        {cards.map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
});
