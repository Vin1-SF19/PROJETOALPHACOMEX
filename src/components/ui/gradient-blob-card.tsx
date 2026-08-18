"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface GradientBlobCardProps {
  children?: ReactNode;
  className?: string;
  surfaceClassName?: string;
  accent?: string;
}

export function GradientBlobCard({
  children,
  className,
  surfaceClassName,
  accent = "37, 99, 235",
}: GradientBlobCardProps) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-[14px]",
        className,
        "border border-blue-600 bg-slate-800/95 shadow-none",
        "transition-transform duration-150 ease-out hover:scale-[1.02]",
        "motion-reduce:transition-none motion-reduce:hover:scale-100",
      )}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 bg-slate-800/95"
      />

      {surfaceClassName && (
        <div
          aria-hidden="true"
          className={cn("absolute inset-0 z-0", surfaceClassName, "border-0")}
        />
      )}

      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 z-20 w-[3px]"
        style={{ backgroundColor: `rgb(${accent})` }}
      />

      {/* Conteudo do card (props do pipeline) */}
      <div className="relative z-10 w-full p-3">{children}</div>
    </div>
  );
}
