"use client";

import { Folder, FolderOpen } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ExplorerCompanyFolder {
  name: string;
  logicalPath: string;
}

interface ExplorerSidebarProps {
  companyFolders: ExplorerCompanyFolder[];
  activePath: string;
  onSelectFolder: (path: string) => void;
  nasOnline: boolean;
}

export function ExplorerSidebar(props: ExplorerSidebarProps) {
  return (
    <aside className="flex h-full w-full flex-col overflow-hidden border-r border-white/[0.06] bg-[#030B19]">
      <div className="flex items-center gap-2.5 px-4 pb-4 pt-5">
        <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[#1677FF] to-[#3B97FF] shadow-[0_0_20px_-4px_rgba(22,119,255,0.7)]">
          <FolderOpen className="size-5 text-white" />
        </span>
        <p className="text-sm font-semibold text-[#F2F6FC]">Alpha Explorer</p>
      </div>

      <p className="border-t border-white/[0.06] px-4 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8FA4C0]/70">Pastas da empresa</p>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <ul className="space-y-0.5" role="tree" aria-label="Pastas da empresa">
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
