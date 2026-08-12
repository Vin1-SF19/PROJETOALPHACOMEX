"use client";

import "./note-editor.css";
import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
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
  Bold, Italic, UnderlineIcon, Strikethrough, List, ListOrdered,
  ListTodo, Quote, Code, Heading1, Heading2,
  Highlighter, Minus, Undo2, Redo2,
} from "lucide-react";
import { AtualizarNota } from "@/actions/Notas";
import { SlashCommand } from "./slash-command";
import { mentionSuggestion } from "./mention-suggestion";
import { TableSizePicker } from "./TableSizePicker";
import { TableEditPanel } from "./TableEditPanel";
import { useNotasWorkspace } from "@/store/useNotasWorkspace";
import { getNotaRascunhoStorageKey } from "@/lib/notas-tabs";
import { cn } from "@/lib/utils";
import { Dock, DockItem, DockIcon, DockLabel } from "@/components/ui/dock";

const AUTOSAVE_DEBOUNCE_MS = 1500;

function ToolbarButton({
  ativo,
  onClick,
  children,
  title,
}: {
  ativo?: boolean;
  onClick: () => void;
  children: React.ReactNode;
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

interface NoteEditorProps {
  noteId: string;
  initialTitle: string;
  initialContentJson: JSONContent;
  initialVersion: number;
  onPreviewChange?: (preview: { noteId: string; title: string; plainText: string }) => void;
}

type StatusSalvamento = "salvo" | "pendente" | "salvando" | "erro" | "conflito" | "offline";

export function NoteEditor({
  noteId,
  initialTitle,
  initialContentJson,
  initialVersion,
  onPreviewChange,
}: NoteEditorProps) {
  const [title, setTitle] = useState(initialTitle);
  const [tituloEditadoManualmente, setTituloEditadoManualmente] = useState(
    initialTitle.trim().length > 0 && initialTitle !== "Sem título",
  );
  const [status, setStatus] = useState<StatusSalvamento>("salvo");
  const versaoRef = useRef(initialVersion);
  const titleRef = useRef(initialTitle);
  const onPreviewChangeRef = useRef(onPreviewChange);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const carregouRef = useRef(false);
  const setSyncState = useNotasWorkspace((state) => state.setSyncState);
  const renomearAba = useNotasWorkspace((state) => state.renomearAba);
  const tabs = useNotasWorkspace((state) => state.tabs);

  const rascunhoKey = getNotaRascunhoStorageKey(noteId);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder: "Escreva sua nota... use / para comandos" }),
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
    ],
    content: initialContentJson ?? "",
    editorProps: {
      attributes: {
        class: "prose prose-invert prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3",
      },
    },
    onUpdate: ({ editor }) => {
      if (!carregouRef.current) return;

      let tituloAtual = titleRef.current;
      if (!tituloEditadoManualmente && tituloAtual.trim().length === 0) {
        const textoInicial = editor.getText().trim().slice(0, 60);
        if (textoInicial) {
          tituloAtual = textoInicial;
          titleRef.current = textoInicial;
          setTitle(textoInicial);
        }
      }

      onPreviewChangeRef.current?.({ noteId, title: tituloAtual, plainText: editor.getText() });
      setStatus("pendente");
      salvarRascunhoLocal(editor.getJSON(), editor.getText());

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(salvar, AUTOSAVE_DEBOUNCE_MS);
    },
  });

  function salvarRascunhoLocal(contentJson: unknown, plainText: string) {
    try {
      localStorage.setItem(
        rascunhoKey,
        JSON.stringify({ title: titleRef.current, contentJson, plainText, baseVersion: versaoRef.current, savedAt: Date.now() }),
      );
    } catch {
      /* localStorage indisponível — rascunho local é best-effort */
    }
  }

  function limparRascunhoLocal() {
    try {
      localStorage.removeItem(rascunhoKey);
    } catch {
      /* ignore */
    }
  }

  async function salvar() {
    if (!editor) return;
    setStatus("salvando");
    setSyncState(noteId, "salvando");

    const contentJson = editor.getJSON();
    const plainText = editor.getText();

    if (!navigator.onLine) {
      setStatus("offline");
      setSyncState(noteId, "offline");
      return;
    }

    const res = await AtualizarNota({
      id: noteId,
      title: titleRef.current,
      contentJson,
      plainText,
      baseVersion: versaoRef.current,
    });

    if (res.success) {
      versaoRef.current = res.data.currentVersion;
      setStatus("salvo");
      setSyncState(noteId, "salvo");
      limparRascunhoLocal();
      return;
    }

    if (res.error === "CONFLITO_VERSAO") {
      setStatus("conflito");
      setSyncState(noteId, "conflito");
      return;
    }

    setStatus("erro");
    setSyncState(noteId, "erro");
  }

  useEffect(() => {
    onPreviewChangeRef.current = onPreviewChange;
  }, [onPreviewChange]);

  useEffect(() => {
    if (!editor) return;

    try {
      const rascunhoRaw = localStorage.getItem(rascunhoKey);
      if (rascunhoRaw) {
        const rascunho = JSON.parse(rascunhoRaw) as {
          title: string;
          contentJson: JSONContent;
          baseVersion: number;
        };
        if (rascunho.baseVersion === initialVersion) {
          editor.commands.setContent(rascunho.contentJson);
          // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura síncrona de localStorage ao montar, sem Promise para usar void
          setTitle(rascunho.title);
          titleRef.current = rascunho.title;
          setStatus("pendente");
        }
      }
    } catch {
      /* ignore */
    }

    carregouRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="flex h-full w-full min-w-0 flex-col">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-white/5 px-2 py-1.5">
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

        <div className="ml-auto flex items-center gap-2 pr-1 text-[10px] uppercase tracking-wide text-slate-500">
          <StatusIndicador status={status} />
        </div>
      </div>

      <input
        value={title}
        onChange={(event) => {
          const novoTitulo = event.target.value;
          setTitle(novoTitulo);
          titleRef.current = novoTitulo;
          setTituloEditadoManualmente(true);
          setStatus("pendente");
          onPreviewChangeRef.current?.({
            noteId,
            title: novoTitulo,
            plainText: editor?.getText() ?? "",
          });

          // Reflete no rótulo da aba na barra de tarefas em tempo real — a aba não sabe do
          // título até a nota ser salva, então sem isso o usuário vê o valor antigo ali.
          if (tabs.some((tab) => tab.noteId === noteId)) {
            const tab = tabs.find((t) => t.noteId === noteId);
            if (tab) renomearAba(tab.id, novoTitulo);
          }

          if (editor) salvarRascunhoLocal(editor.getJSON(), editor.getText());

          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(salvar, AUTOSAVE_DEBOUNCE_MS);
        }}
        placeholder="Sem título"
        className="w-full border-b border-white/5 bg-transparent px-4 py-2 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
      />

      <div className="min-w-0 flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function StatusIndicador({ status }: { status: StatusSalvamento }) {
  const labels: Record<StatusSalvamento, string> = {
    salvo: "Salvo",
    pendente: "Alterações pendentes",
    salvando: "Salvando...",
    erro: "Falha ao salvar",
    conflito: "Conflito de versão",
    offline: "Sem conexão — salvo localmente",
  };

  const cores: Record<StatusSalvamento, string> = {
    salvo: "text-emerald-500",
    pendente: "text-amber-500",
    salvando: "text-blue-400",
    erro: "text-rose-500",
    conflito: "text-rose-500",
    offline: "text-slate-500",
  };

  return <span className={cores[status]}>{labels[status]}</span>;
}
