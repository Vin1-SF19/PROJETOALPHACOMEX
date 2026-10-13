"use client";

import "./note-editor.css";

import { useState, type ReactNode } from "react";
import { EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Mention from "@tiptap/extension-mention";
import {
  Bold,
  Code,
  Palette,
  Heading1,
  Heading2,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  UnderlineIcon,
  Undo2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Dock, DockIcon, DockItem, DockLabel } from "@/components/ui/dock";
import { mentionSuggestion } from "@/components/Notas/NoteEditor/mention-suggestion";
import { SlashCommand } from "@/components/Notas/NoteEditor/slash-command";
import { TableEditPanel } from "@/components/Notas/NoteEditor/TableEditPanel";
import { TableSizePicker } from "@/components/Notas/NoteEditor/TableSizePicker";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Z_INDEX } from "@/lib/z-index";

const CORES_TEXTO = ["#ffffff", "#f59e0b", "#f43f5e", "#8b5cf6", "#06b6d4", "#10b981", "#3b82f6", "#ec4899", "#84cc16"];

function SeletorCorTexto({ editor, ponto }: { editor: Editor; ponto?: { x: number; y: number } }) {
  const [open, setOpen] = useState(Boolean(ponto));
  const paleta = (
    <PopoverContent align="start" style={{ zIndex: Z_INDEX.dropdown }} className="w-52 border-white/10 bg-[#0b1120] p-3" onOpenAutoFocus={(event) => event.preventDefault()}>
      <p className="mb-2 text-[10px] uppercase tracking-wide text-slate-500">Cor do texto</p>
      <div className="flex flex-wrap gap-2">
        {CORES_TEXTO.map((cor) => (
          <button key={cor} type="button" title={cor} aria-label={`Aplicar cor ${cor}`} onMouseDown={(event) => event.preventDefault()} onClick={() => { editor.chain().focus().setColor(cor).run(); setOpen(false); }} style={{ backgroundColor: cor }} className="h-7 w-7 rounded-full border border-white/20 hover:ring-2 hover:ring-white/60" />
        ))}
        <button type="button" title="Cor padrão" aria-label="Remover cor do texto" onMouseDown={(event) => event.preventDefault()} onClick={() => { editor.chain().focus().unsetColor().run(); setOpen(false); }} className="h-7 rounded-full border border-white/15 px-2 text-[10px] text-slate-300 hover:bg-white/10">Padrão</button>
        <label className="relative flex h-7 cursor-pointer items-center rounded-full border border-white/15 px-2 text-[10px] text-slate-300 hover:bg-white/10" title="Escolher qualquer cor">
          Personalizada
          <input type="color" aria-label="Escolher cor personalizada" defaultValue="#f59e0b" onChange={(event) => { editor.chain().focus().setColor(event.currentTarget.value).run(); setOpen(false); }} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        </label>
      </div>
    </PopoverContent>
  );

  if (ponto) return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild><span aria-hidden="true" className="pointer-events-none fixed h-px w-px" style={{ left: ponto.x, top: ponto.y }} /></PopoverAnchor>
      {paleta}
    </Popover>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <button type="button" title="Cor do texto" aria-label="Cor do texto" onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen((atual) => !atual)} className="flex h-7 items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"><Palette size={15} /></button>
      </PopoverAnchor>
      {paleta}
    </Popover>
  );
}

export function criarExtensoesEditorNote(placeholder: string) {
  return [
    StarterKit,
    Underline,
    Link.configure({ openOnClick: false }),
    Image,
    Placeholder.configure({ placeholder }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    SlashCommand,
    Mention.configure({
      HTMLAttributes: { class: "text-indigo-400 font-medium" },
      suggestion: mentionSuggestion,
    }),
  ];
}

function ToolbarButton({
  ativo,
  onClick,
  children,
  title,
}: {
  ativo?: boolean;
  onClick: () => void;
  children: ReactNode;
  title: string;
}) {
  return (
    <DockItem>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex h-7 items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white",
          ativo && "bg-white/10 text-white",
        )}
      >
        <DockIcon>{children}</DockIcon>
        <DockLabel>{title}</DockLabel>
      </button>
    </DockItem>
  );
}

export function NoteEditorToolbar({ editor, status }: { editor: Editor; status?: ReactNode }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-white/5 px-2 py-1.5" data-guia-notas="editor-toolbar">
      <Dock orientation="horizontal" magnification={38} distance={80} panelSize={28} className="gap-0.5">
        <ToolbarButton title="Título" ativo={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 size={15} />
        </ToolbarButton>
        <ToolbarButton title="Subtítulo" ativo={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 size={15} />
        </ToolbarButton>
        <ToolbarButton title="Negrito" ativo={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton title="Itálico" ativo={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={15} />
        </ToolbarButton>
        <ToolbarButton title="Sublinhado" ativo={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon size={15} />
        </ToolbarButton>
        <ToolbarButton title="Tachado" ativo={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough size={15} />
        </ToolbarButton>
        <ToolbarButton title="Destaque" ativo={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()}>
          <Highlighter size={15} />
        </ToolbarButton>
        <DockItem><SeletorCorTexto editor={editor} /></DockItem>
        <ToolbarButton title="Lista" ativo={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={15} />
        </ToolbarButton>
        <ToolbarButton title="Lista numerada" ativo={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={15} />
        </ToolbarButton>
        <ToolbarButton title="Checklist" ativo={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}>
          <ListTodo size={15} />
        </ToolbarButton>
        <ToolbarButton title="Citação" ativo={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote size={15} />
        </ToolbarButton>
        <ToolbarButton title="Código" ativo={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <Code size={15} />
        </ToolbarButton>
        <DockItem>
          <TableSizePicker
            onEscolher={(linhas, colunas) =>
              editor.chain().focus().insertTable({ rows: linhas, cols: colunas, withHeaderRow: true }).run()
            }
          />
        </DockItem>
        <DockItem>
          <TableEditPanel editor={editor} />
        </DockItem>
        <ToolbarButton title="Divisor" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus size={15} />
        </ToolbarButton>
        <div className="mx-1 h-4 w-px bg-white/10" />
        <ToolbarButton title="Desfazer" onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 size={15} />
        </ToolbarButton>
        <ToolbarButton title="Refazer" onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 size={15} />
        </ToolbarButton>
      </Dock>
      {status && <div className="ml-auto flex items-center gap-2 pr-1 text-[10px] uppercase tracking-wide text-slate-500">{status}</div>}
    </div>
  );
}

export function NoteEditorContent({ editor, className }: { editor: Editor; className?: string }) {
  const [pontoContexto, setPontoContexto] = useState<{ x: number; y: number; id: number } | undefined>();
  return (
    <div className={cn("relative min-w-0 flex-1 overflow-y-auto", className)} onContextMenu={(event) => {
      if (editor.state.selection.empty || !editor.isEditable) return;
      event.preventDefault();
      setPontoContexto({ x: event.clientX, y: event.clientY, id: Date.now() });
    }}>
      <EditorContent editor={editor} />
      {pontoContexto && <div key={pontoContexto.id} className="fixed z-40" style={{ left: pontoContexto.x, top: pontoContexto.y }}><SeletorCorTexto editor={editor} ponto={pontoContexto} /></div>}
    </div>
  );
}
