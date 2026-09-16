"use client";

import { Download, FolderOpen, MoreHorizontal, RotateCcw, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { FileIcon } from "./FileIcon";
import type { ExplorerItemView } from "./types";
import { fileKindLabel, formatSize, formatDate, resolveFileKind } from "./visual";
import type { ExplorerItemAction } from "./FileList";

interface FileDetailsProps {
  item: ExplorerItemView | null;
  trash: boolean;
  admin: boolean;
  onClose: () => void;
  onOpenFolder: (path: string) => void;
  onDownload: (item: ExplorerItemView) => void;
  onAction: (item: ExplorerItemView, action: ExplorerItemAction) => void;
}

export function FileDetails(props: FileDetailsProps) {
  const { item } = props;

  const body = item && (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 border-b border-white/[0.06] px-4 py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8FA4C0]">
            {item.kind === "FOLDER" ? "Detalhes da pasta" : "Detalhes do arquivo"}
          </p>
          <h2 className="mt-1 break-words text-base font-semibold text-[#F2F6FC]">{item.name}</h2>
        </div>
        <Button variant="ghost" size="icon" aria-label="Fechar detalhes" onClick={props.onClose} className="size-8 text-[#8FA4C0] hover:text-[#F2F6FC]">
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto mb-5 grid size-20 place-items-center rounded-2xl bg-[#0A1830] ring-1 ring-inset ring-white/[0.08] shadow-[0_10px_40px_-16px_rgba(22,119,255,0.5)]">
          <FileIcon kind={resolveFileKind(item)} className="size-10" />
        </div>

        <dl className="space-y-3.5 text-[13px]">
          <DetailRow label="Tipo" value={fileKindLabel(resolveFileKind(item))} />
          <DetailRow label="Tamanho" value={formatSize(item.sizeBytes)} />
          <DetailRow label="Localização" value={item.logicalPath || "Arquivos"} mono />
          <DetailRow label="Modificado em" value={formatDate(item.updatedAt)} />
          <DetailRow label="Criado em" value={formatDate(item.createdAt)} />
          {item.providerLabel && <DetailRow label="Origem" value={item.providerLabel} />}
          {props.admin && <DetailRow label="Versão" value={`v${item.version}`} />}
        </dl>

        <div className="mt-6 flex flex-wrap gap-2">
          {item.kind === "FOLDER" ? (
            <Button size="sm" onClick={() => props.onOpenFolder(item.logicalPath)} className="rounded-xl bg-gradient-to-r from-[#1677FF] to-[#3B97FF] text-white shadow-[0_6px_20px_-8px_rgba(22,119,255,0.8)] hover:translate-y-[-1px]">
              <FolderOpen className="mr-2 size-4" />
              Abrir pasta
            </Button>
          ) : (
            <Button size="sm" onClick={() => props.onDownload(item)} className="rounded-xl bg-gradient-to-r from-[#1677FF] to-[#3B97FF] text-white shadow-[0_6px_20px_-8px_rgba(22,119,255,0.8)] hover:translate-y-[-1px]">
              <Download className="mr-2 size-4" />
              Baixar
            </Button>
          )}
          <MoreActions item={item} trash={props.trash} onAction={props.onAction} />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden w-[300px] shrink-0 flex-col border-l border-white/[0.06] bg-[#040D1D]/70 lg:flex xl:w-[340px]">
        {item ? body : <EmptyDetails />}
      </div>

      <Sheet open={Boolean(item)} onOpenChange={(open) => { if (!open) props.onClose(); }}>
        <SheetContent className="w-full border-white/[0.08] bg-[#040D1D] sm:max-w-[380px]">
          <SheetHeader className="sr-only">
            <SheetTitle>{item?.name}</SheetTitle>
            <SheetDescription>Detalhes do item selecionado</SheetDescription>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    </>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-[#8FA4C0]/80">{label}</dt>
      <dd className={cn("mt-0.5 break-words text-[#F2F6FC]", mono && "font-mono text-[12px]")}>{value}</dd>
    </div>
  );
}

function MoreActions({ item, trash, onAction }: { item: ExplorerItemView; trash: boolean; onAction: FileDetailsProps["onAction"] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl border-white/[0.1] bg-[#07152B] text-[#F2F6FC] hover:bg-[#0A1830]">
          <MoreHorizontal className="mr-2 size-4" />
          Mais
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44 rounded-xl border-white/[0.08] bg-[#0A1830]">
        {!trash && <DropdownMenuItem onClick={() => onAction(item, "rename")} className="rounded-lg text-[13px]">Renomear</DropdownMenuItem>}
        {!trash && <DropdownMenuItem onClick={() => onAction(item, "move")} className="rounded-lg text-[13px]">Mover para...</DropdownMenuItem>}
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

function EmptyDetails() {
  return (
    <div className="grid flex-1 place-items-center px-6 text-center">
      <div>
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-[#07152B] ring-1 ring-inset ring-white/[0.06]">
          <FileIcon kind="folder" className="size-6" />
        </div>
        <p className="text-sm font-medium text-[#F2F6FC]">Nenhum item selecionado</p>
        <p className="mt-1 text-[13px] text-[#8FA4C0]">Selecione um arquivo ou pasta para ver os detalhes aqui.</p>
      </div>
    </div>
  );
}
