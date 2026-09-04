"use client";

import { useEffect, useRef } from "react";
import { Building2, CalendarDays, FileText, MapPin, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Timeline } from "./Timeline";
import { useClientTimeline } from "./useClientTimeline";
import { fmtDate } from "@/lib/format-date";
import { formatCNPJ } from "@/lib/format-cnpj";
import { cn } from "@/lib/utils";
import type { TimelineEvent } from "@/lib/timeline/types";

interface EmpresaInfo {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  municipio?: string;
  uf?: string;
  regimeTributario?: string;
  situacao?: string;
  analistaResponsavel?: string;
}

interface PerfilEmpresaModalProps {
  empresaId: number;
  empresa: EmpresaInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAbrirCard?: (cardId: string) => void;
}

function SkeletonTimeline() {
  return (
    <div className="space-y-6" role="status" aria-label="Carregando timeline">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <Skeleton className="h-2.5 w-2.5 rounded-full" />
            <Skeleton className="w-px flex-1" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PerfilEmpresaModal({
  empresaId,
  empresa,
  open,
  onOpenChange,
  onAbrirCard,
}: PerfilEmpresaModalProps) {
  const { events, loading, error, modules, total, refetch } = useClientTimeline(
    open ? empresaId : null
  );

  const handleEventClick = (event: TimelineEvent) => {
    const cardId = event.metadata?.cardId;
    if (typeof cardId === "number" && onAbrirCard) {
      onOpenChange(false);
      onAbrirCard(String(cardId));
    }
  };

  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      // Focus trap: move focus to close button on open
      const timer = setTimeout(() => closeBtnRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const situacao = empresa.situacao?.toUpperCase();
  const isPositive =
    situacao === "DEFERIDA" ||
    situacao === "ATIVO" ||
    situacao === "EM ANDAMENTO" ||
    situacao === "STAND BY";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "z-[60] flex max-h-[80vh] w-[80vw] max-w-[1400px] flex-col gap-0 overflow-hidden",
          "border-white/10 bg-slate-950 p-0 text-slate-100 shadow-2xl"
        )}
        aria-label={`Perfil da empresa: ${empresa.razaoSocial}`}
      >
        {/* Header */}
        <DialogHeader className="shrink-0 border-b border-white/10 px-6 py-5 pr-12">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2.5 text-lg font-bold">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
                  <Building2 size={18} aria-hidden="true" />
                </span>
                <span className="truncate">
                  {empresa.nomeFantasia || empresa.razaoSocial}
                </span>
              </DialogTitle>
              <DialogDescription className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                <span className="font-mono">{formatCNPJ(empresa.cnpj) ?? empresa.cnpj}</span>
                {empresa.uf && (
                  <span className="flex items-center gap-1">
                    <MapPin size={12} aria-hidden="true" />
                    {empresa.municipio ? `${empresa.municipio} - ${empresa.uf}` : empresa.uf}
                  </span>
                )}
                {empresa.regimeTributario && (
                  <span className="flex items-center gap-1">
                    <FileText size={12} aria-hidden="true" />
                    {empresa.regimeTributario}
                  </span>
                )}
                {empresa.analistaResponsavel && (
                  <span className="flex items-center gap-1">
                    <CalendarDays size={12} aria-hidden="true" />
                    Analista: {empresa.analistaResponsavel}
                  </span>
                )}
              </DialogDescription>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {empresa.situacao && (
                <Badge
                  variant="outline"
                  className={cn(
                    "border font-bold text-xs",
                    isPositive
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                      : "border-rose-500/20 bg-rose-500/10 text-rose-400"
                  )}
                >
                  {empresa.situacao}
                </Badge>
              )}
              <button
                ref={closeBtnRef}
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label="Fechar modal"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <SkeletonTimeline />
          ) : error ? (
            <div role="alert" className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm text-rose-300">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={refetch}
                className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              >
                Tentar novamente
              </Button>
            </div>
          ) : (
            <Timeline events={events} onEventClick={onAbrirCard ? handleEventClick : undefined} />
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-white/10 px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">
                {total} evento{total !== 1 ? "s" : ""}
              </span>
              {modules.map((mod) => (
                <Badge
                  key={mod}
                  variant="outline"
                  className="border-white/10 bg-white/5 text-[10px] font-medium text-slate-400"
                  aria-label={`Módulo: ${mod}`}
                >
                  {mod}
                </Badge>
              ))}
            </div>
            <span className="text-[11px] text-slate-600">
              Última atualização: {fmtDate(new Date().toISOString())}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
