"use client";

import { ArrowUp, Grid2X2, List, Plus, Search, Shield } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type ExplorerSort = "name" | "size" | "createdAt";

interface ExplorerToolbarProps {
  crumbs: string[];
  canGoUp: boolean;
  onGoUp: () => void;
  onSelectCrumb: (path: string) => void;
  searchInput: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  sort: ExplorerSort;
  onSortChange: (value: ExplorerSort) => void;
  admin: boolean;
  view: "list" | "grid";
  onViewChange: (view: "list" | "grid") => void;
  writeEnabled: boolean;
  upload: React.ReactNode;
  onNewFolder: () => void;
}

export function ExplorerToolbar(props: ExplorerToolbarProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-white/[0.06] px-5 py-3">
      <div data-guia-explorer="navigation" className="flex flex-wrap items-center gap-1" aria-label="Caminho atual">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Subir um nível"
          disabled={!props.canGoUp}
          onClick={props.onGoUp}
          className="size-8 text-[#8FA4C0] hover:text-[#F2F6FC]"
        >
          <ArrowUp className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => props.onSelectCrumb("")} className="text-[#8FA4C0] hover:text-[#F2F6FC]">
          Arquivos
        </Button>
        {props.crumbs.map((segment, index) => (
          <span key={`${segment}-${index}`} className="flex items-center">
            <span className="px-1 text-[#8FA4C0]/40" aria-hidden>/</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => props.onSelectCrumb(props.crumbs.slice(0, index + 1).join("/"))}
              className={cn(index === props.crumbs.length - 1 ? "text-[#F2F6FC]" : "text-[#8FA4C0] hover:text-[#F2F6FC]")}
            >
              {segment}
            </Button>
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form
          data-guia-explorer="search"
          className="flex min-w-0 flex-1 gap-2"
          onSubmit={(event) => { event.preventDefault(); props.onSearchSubmit(); }}
        >
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Pesquisar nesta pasta</span>
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8FA4C0]" />
            <Input
              value={props.searchInput}
              onChange={(event) => props.onSearchChange(event.target.value)}
              placeholder="Buscar nesta pasta..."
              className="h-9 rounded-xl border-white/[0.08] bg-[#07152B] pl-9 text-[#F2F6FC] placeholder:text-[#8FA4C0]/70 focus-visible:ring-2 focus-visible:ring-[#1677FF]/50"
            />
          </label>
          <Button type="submit" variant="secondary" className="rounded-xl">Buscar</Button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Ordenar arquivos"
            className="h-9 rounded-xl border border-white/[0.08] bg-[#07152B] px-3 text-sm text-[#F2F6FC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1677FF]/50"
            value={props.sort}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "name" || value === "size" || value === "createdAt") props.onSortChange(value);
            }}
          >
            <option value="name">Nome</option>
            <option value="size">Tamanho</option>
            <option value="createdAt">Data</option>
          </select>

          {props.admin && (
            <Button asChild variant="outline" size="icon" className="rounded-xl">
              <Link href="/PainelAlpha/ExploradorArquivos/AdministracaoQnap" aria-label="Administração QNAP" title="Administração QNAP">
                <Shield className="size-4" />
              </Link>
            </Button>
          )}

          <Button
            variant="outline"
            size="icon"
            aria-label={props.view === "list" ? "Visualizar em grade" : "Visualizar em lista"}
            onClick={() => props.onViewChange(props.view === "list" ? "grid" : "list")}
            className="rounded-xl"
          >
            {props.view === "list" ? <Grid2X2 className="size-4" /> : <List className="size-4" />}
          </Button>

          {props.upload}

          <Button
            data-guia-explorer="folder"
            variant="outline"
            size="sm"
            disabled={!props.writeEnabled}
            onClick={props.onNewFolder}
            className="rounded-xl border-[#1677FF]/40 bg-[#1677FF]/5 text-[#F2F6FC] hover:bg-[#1677FF]/15"
          >
            <Plus className="mr-2 size-4" />
            Nova pasta
          </Button>
        </div>
      </div>
    </div>
  );
}
