"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Table as TableIcon, Rows3, Columns3, Rows, Columns,
  Trash2, Combine, SquareSplitHorizontal, PanelTopClose,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface TableEditPanelProps {
  editor: Editor;
}

interface AcaoTabela {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  destrutiva?: boolean;
}

/**
 * Painel de edição de tabela (estilo Word: Layout de Tabela) — só faz sentido enquanto o
 * cursor está dentro de uma tabela existente (editor.isActive("table")). Controla linhas,
 * colunas, mesclagem e cabeçalho via os comandos nativos do @tiptap/extension-table.
 */
export function TableEditPanel({ editor }: TableEditPanelProps) {
  const [open, setOpen] = useState(false);
  // Incrementado a cada ação — força o Radix Popover a remontar do zero, garantindo que ele
  // nunca fique preso em open=true por uma disputa de foco com o editor.focus() das ações
  // (mesmo padrão defensivo usado em TableSizePicker).
  const [instancia, setInstancia] = useState(0);
  const dentroDeTabela = editor.isActive("table");

  const acoes: AcaoTabela[] = [
    { label: "Linha acima", icon: <Rows3 size={14} />, onClick: () => editor.chain().focus().addRowBefore().run() },
    { label: "Linha abaixo", icon: <Rows3 size={14} className="rotate-180" />, onClick: () => editor.chain().focus().addRowAfter().run() },
    { label: "Excluir linha", icon: <Rows size={14} />, onClick: () => editor.chain().focus().deleteRow().run(), destrutiva: true },
    { label: "Coluna à esquerda", icon: <Columns3 size={14} />, onClick: () => editor.chain().focus().addColumnBefore().run() },
    { label: "Coluna à direita", icon: <Columns3 size={14} className="rotate-180" />, onClick: () => editor.chain().focus().addColumnAfter().run() },
    { label: "Excluir coluna", icon: <Columns size={14} />, onClick: () => editor.chain().focus().deleteColumn().run(), destrutiva: true },
    { label: "Mesclar células", icon: <Combine size={14} />, onClick: () => editor.chain().focus().mergeCells().run() },
    { label: "Dividir célula", icon: <SquareSplitHorizontal size={14} />, onClick: () => editor.chain().focus().splitCell().run() },
    { label: "Alternar cabeçalho", icon: <PanelTopClose size={14} />, onClick: () => editor.chain().focus().toggleHeaderRow().run() },
    { label: "Excluir tabela", icon: <Trash2 size={14} />, onClick: () => editor.chain().focus().deleteTable().run(), destrutiva: true },
  ];

  return (
    <Popover key={instancia} open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={dentroDeTabela ? "Editar tabela" : "Coloque o cursor dentro de uma tabela para editá-la"}
          disabled={!dentroDeTabela}
          className={cn(
            "flex h-7 items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent",
            open && "bg-white/10 text-white",
          )}
        >
          <TableIcon size={15} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-56 border-white/10 bg-[#0b1120] p-2"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <p className="mb-1.5 px-1 text-[10px] uppercase tracking-wide text-slate-500">Editar tabela</p>
        <div className="flex flex-col gap-0.5">
          {acoes.map((acao) => (
            <button
              key={acao.label}
              type="button"
              onClick={() => {
                acao.onClick();
                setOpen(false);
                setInstancia((n) => n + 1);
              }}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-300 hover:bg-white/5",
                acao.destrutiva && "text-rose-400 hover:bg-rose-500/10",
              )}
            >
              {acao.icon}
              {acao.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
