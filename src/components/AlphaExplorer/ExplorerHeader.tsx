"use client";

import { Folder, HelpCircle, Shield } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExplorerHeaderProps {
  admin: boolean;
  nasOnline: boolean;
  onOpenTour: () => void;
}

export function ExplorerHeader({ admin, nasOnline, onOpenTour }: ExplorerHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-white/[0.06] bg-[#040D1D]/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3.5">
        <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-[#0A1E3D] to-[#07152B] ring-1 ring-inset ring-[#1677FF]/25 shadow-[0_8px_30px_-12px_rgba(22,119,255,0.55)]">
          <Folder className="size-6 text-[#3B97FF]" />
        </span>
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-[#F2F6FC] sm:text-[32px]">
            Explorer de Arquivos
          </h1>
          <p className="text-sm text-[#8FA4C0]">Acesse seus arquivos da empresa com segurança.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-full bg-[#07152B] px-3 py-1.5 ring-1 ring-inset ring-white/[0.06]">
          <span className="relative flex size-2">
            <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-60", nasOnline ? "animate-ping bg-emerald-400" : "bg-red-500")} />
            <span className={cn("relative inline-flex size-2 rounded-full", nasOnline ? "bg-emerald-400" : "bg-red-500")} />
          </span>
          <span className={cn("text-xs font-medium", nasOnline ? "text-[#F2F6FC]" : "text-red-300")}>
            {nasOnline ? "Conectado ao NAS" : "NAS indisponível"}
          </span>
        </div>

        {admin && (
          <Button asChild variant="outline" size="sm">
            <Link href="/PainelAlpha/ExploradorArquivos/AdministracaoQnap">
              <Shield className="mr-2 size-4" />
              Administração QNAP
            </Link>
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={onOpenTour}>
          <HelpCircle className="mr-2 size-4" />
          Como usar
        </Button>
      </div>
    </header>
  );
}
