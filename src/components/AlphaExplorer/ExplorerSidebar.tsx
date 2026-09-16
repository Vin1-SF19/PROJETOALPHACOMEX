"use client";

import { Folder, FolderOpen, HardDrive, Home, Share2, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type ExplorerNavKey = "meus" | "compartilhados" | "lixeira";

export interface ExplorerCompanyFolder {
  name: string;
  logicalPath: string;
}

interface ExplorerSidebarProps {
  navKey: ExplorerNavKey;
  onNavigate: (key: ExplorerNavKey) => void;
  companyFolders: ExplorerCompanyFolder[];
  activePath: string;
  onSelectFolder: (path: string) => void;
  nasOnline: boolean;
}

export function ExplorerSidebar(props: ExplorerSidebarProps) {
  const navItems = [
    { key: "meus" as const, label: "Meus Arquivos", Icon: Home },
    { key: "compartilhados" as const, label: "Compartilhados", Icon: Share2 },
    { key: "lixeira" as const, label: "Lixeira", Icon: Trash2 },
  ];

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden border-r border-white/[0.06] bg-[#030B19]">
      <div className="flex items-center gap-2.5 px-4 pb-4 pt-5">
        <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[#1677FF] to-[#3B97FF] shadow-[0_0_20px_-4px_rgba(22,119,255,0.7)]">
          <FolderOpen className="size-5 text-white" />
        </span>
        <div className="leading-tight">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8FA4C0]">Painel Alpha</p>
          <p className="text-sm font-semibold text-[#F2F6FC]">Explorer</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1 px-3" aria-label="Navegação do Explorer">
        {navItems.map(({ key, label, Icon }) => {
          const active = props.navKey === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => props.onNavigate(key)}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
                active
                  ? "bg-[#1677FF]/15 text-[#F2F6FC] ring-1 ring-inset ring-[#1677FF]/30"
                  : "text-[#8FA4C0] hover:bg-white/[0.04] hover:text-[#F2F6FC]",
              )}
            >
              <Icon className={cn("size-4", active ? "text-[#3B97FF]" : "text-[#8FA4C0] group-hover:text-[#8FA4C0]")} />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mx-4 my-3 h-px bg-white/[0.06]" />

      <p className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8FA4C0]/70">Pastas da empresa</p>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <button
          type="button"
          onClick={() => props.onSelectFolder("compartilhados")}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-150",
            props.activePath === "compartilhados"
              ? "bg-[#1677FF]/15 text-[#F2F6FC] ring-1 ring-inset ring-[#1677FF]/30"
              : "text-[#F2F6FC] hover:bg-white/[0.04]",
          )}
        >
          <HardDrive className="size-4 shrink-0 text-[#3B97FF]" />
          <span className="truncate">NAS Principal</span>
        </button>

        <ul className="mt-1 space-y-0.5 pl-4" role="tree" aria-label="Pastas da empresa">
          {props.companyFolders.map((folder) => {
            const active = props.activePath === folder.logicalPath;
            return (
              <li key={folder.logicalPath}>
                <button
                  type="button"
                  role="treeitem"
                  aria-selected={active}
                  onClick={() => props.onSelectFolder(folder.logicalPath)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors duration-150",
                    active
                      ? "bg-[#1677FF]/15 text-[#F2F6FC] ring-1 ring-inset ring-[#1677FF]/25"
                      : "text-[#8FA4C0] hover:bg-white/[0.04] hover:text-[#F2F6FC]",
                  )}
                >
                  <span className="text-[#8FA4C0]/40" aria-hidden>└</span>
                  <Folder className={cn("size-4 shrink-0", active ? "text-amber-300" : "text-[#8FA4C0]")} />
                  <span className="truncate">{folder.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-center gap-2.5 rounded-lg bg-[#07152B] px-3 py-2.5 ring-1 ring-inset ring-white/[0.06]">
          <span className="relative flex size-2.5">
            <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-60", props.nasOnline ? "animate-ping bg-emerald-400" : "bg-red-500")} />
            <span className={cn("relative inline-flex size-2.5 rounded-full", props.nasOnline ? "bg-emerald-400" : "bg-red-500")} />
          </span>
          <div className="leading-tight">
            <p className={cn("text-[13px] font-medium", props.nasOnline ? "text-[#F2F6FC]" : "text-red-300")}>
              {props.nasOnline ? "Conectado ao NAS" : "NAS indisponível"}
            </p>
            <p className="text-[11px] text-[#8FA4C0]">Servidor da empresa</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
