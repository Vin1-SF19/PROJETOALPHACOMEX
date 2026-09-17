"use client";

import { Download, ExternalLink, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { FileIcon } from "./FileIcon";
import type { ExplorerItemView } from "./types";
import { fileKindLabel, formatSize, formatRelative, resolveFileKind } from "./visual";

export type ExplorerItemAction = "rename" | "move" | "delete" | "restore";

interface FileListProps {
  items: ExplorerItemView[];
  view: "list" | "grid";
  trash: boolean;
  selected: ExplorerItemView | null;
  onSelect: (item: ExplorerItemView | null) => void;
  onOpenFolder: (path: string) => void;
  onOpenFile: (item: ExplorerItemView) => void;
  onDownload: (item: ExplorerItemView) => void;
  onAction: (item: ExplorerItemView, action: ExplorerItemAction) => void;
}

export function FileList(props: FileListProps) {
  if (props.items.length === 0) {
    return (
      <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-white/[0.08] text-center">
        <div>
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-[#07152B] ring-1 ring-inset ring-white/[0.06]">
            <FileIcon kind="folder" className="size-8" />
          </div>
          <p className="text-sm font-medium text-[#F2F6FC]">Esta pasta está vazia.</p>
          <p className="mt-1 text-[13px] text-[#8FA4C0]">Adicione arquivos ou crie uma nova pasta.</p>
        </div>
      </div>
    );
  }

  return (
    <div data-guia-explorer="files" className={cn(props.view === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" : "overflow-x-auto")}>
      {props.view === "list" && (
        <div className="grid min-w-[720px] grid-cols-[minmax(240px,1fr)_120px_150px_110px_44px] items-center border-b border-white/[0.06] bg-[#07152B]/60 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#8FA4C0]">
          <span>Nome</span>
          <span>Tamanho</span>
          <span>Modificado</span>
          <span>Origem</span>
          <span />
        </div>
      )}

      {props.items.map((item) => {
        const kind = resolveFileKind(item);
        const virtual = item.id.startsWith("root:");
        const isSelected = props.selected?.id === item.id;

        const row = (
          <>
            <button
              type="button"
              onClick={() => (item.kind === "FOLDER" ? props.onOpenFolder(item.logicalPath) : props.onSelect(item))}
              onDoubleClick={() => (item.kind === "FILE" ? props.onOpenFile(item) : props.onOpenFolder(item.logicalPath))}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                if (item.kind === "FILE") props.onOpenFile(item);
                else props.onOpenFolder(item.logicalPath);
              }}
              title={item.kind === "FILE" ? "Clique duas vezes para abrir" : "Abrir pasta"}
              className="flex min-w-0 items-center gap-3 text-left focus-visible:outline-none"
            >
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg ring-1 ring-inset ring-white/[0.06]", isSelected ? "bg-[#1677FF]/15" : "bg-[#0A1830]")}>
                <FileIcon kind={kind} className="size-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-medium text-[#F2F6FC]">{item.name}</span>
                <span className="block truncate text-[11px] text-[#8FA4C0]">{fileKindLabel(kind)}</span>
              </span>
            </button>

            <span className="text-[13px] text-[#8FA4C0]">{formatSize(item.sizeBytes)}</span>
            <span className="text-[13px] text-[#8FA4C0]">
              {item.updatedAt === new Date(0).toISOString() ? "—" : formatRelative(item.updatedAt)}
            </span>
            <span className="text-[13px] text-[#8FA4C0]">{item.providerLabel ?? "—"}</span>

            {!virtual && (
              <span className="flex justify-end">
                <ItemMenu item={item} trash={props.trash} onOpenFile={props.onOpenFile} onDownload={props.onDownload} onAction={props.onAction} />
              </span>
            )}
          </>
        );

        return props.view === "grid" ? (
          <article
            key={item.id}
            className={cn(
              "group relative flex min-h-32 flex-col justify-between rounded-xl border bg-[#07152B] p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-[#1677FF]/40",
              isSelected ? "border-[#1677FF]/60 ring-1 ring-inset ring-[#1677FF]/40" : "border-white/[0.06]",
            )}
          >
            {row}
          </article>
        ) : (
          <article
            key={item.id}
            className={cn(
              "grid min-w-[720px] grid-cols-[minmax(240px,1fr)_120px_150px_110px_44px] items-center border-b border-white/[0.04] px-4 py-2.5 transition-colors duration-150 last:border-0",
              isSelected
                ? "bg-[#1677FF]/10 ring-1 ring-inset ring-[#1677FF]/30"
                : "hover:bg-[#1677FF]/[0.06]",
            )}
          >
            {row}
          </article>
        );
      })}
    </div>
  );
}

function ItemMenu({ item, trash, onOpenFile, onDownload, onAction }: {
  item: ExplorerItemView;
  trash: boolean;
  onOpenFile: (item: ExplorerItemView) => void;
  onDownload: (item: ExplorerItemView) => void;
  onAction: (item: ExplorerItemView, action: ExplorerItemAction) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Ações de ${item.name}`} className="size-8 text-[#8FA4C0] hover:text-[#F2F6FC]">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44 rounded-xl border-white/[0.08] bg-[#0A1830]">
        {!trash && item.kind === "FILE" && (
          <DropdownMenuItem onClick={() => onOpenFile(item)} className="rounded-lg text-[13px]">
            <ExternalLink className="mr-2 size-4" />
            Abrir
          </DropdownMenuItem>
        )}
        {!trash && item.kind === "FILE" && (
          <DropdownMenuItem onClick={() => onDownload(item)} className="rounded-lg text-[13px]">
            <Download className="mr-2 size-4" />
            Baixar
          </DropdownMenuItem>
        )}
        {!trash && (
          <DropdownMenuItem onClick={() => onAction(item, "rename")} className="rounded-lg text-[13px]">
            Renomear
          </DropdownMenuItem>
        )}
        {!trash && (
          <DropdownMenuItem onClick={() => onAction(item, "move")} className="rounded-lg text-[13px]">
            Mover
          </DropdownMenuItem>
        )}
        {!trash && (
          <DropdownMenuItem onClick={() => onAction(item, "delete")} className="rounded-lg text-[13px] text-red-300 focus:text-red-200">
            <Trash2 className="mr-2 size-4" />
            Mover para lixeira
          </DropdownMenuItem>
        )}
        {trash && (
          <DropdownMenuItem onClick={() => onAction(item, "restore")} className="rounded-lg text-[13px]">
            <RotateCcw className="mr-2 size-4" />
            Restaurar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
