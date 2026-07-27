"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
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
import {
  Bold, Italic, UnderlineIcon, Strikethrough, List, ListOrdered,
  ListTodo, Quote, Code, Table as TableIcon, Heading1, Heading2,
} from "lucide-react";
import { ListarDocumentosBlueprint, SalvarDocumentoBlueprint } from "@/actions/BlueprintDocuments";

const AUTOSAVE_DEBOUNCE_MS = 1500;

interface SpecificationEditorProps {
  projectId: string;
  accent: string;
}

type StatusSalvamento = "carregando" | "salvo" | "salvando" | "pendente" | "erro";

function ToolbarButton({ ativo, onClick, children, title }: { ativo?: boolean; onClick: () => void; children: React.ReactNode; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors data-[ativo=true]:text-white"
      data-ativo={ativo}
    >
      {children}
    </button>
  );
}

export function SpecificationEditor({ projectId, accent }: SpecificationEditorProps) {
  const [documentId, setDocumentId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<StatusSalvamento>("carregando");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const carregouRef = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder: "Escreva a especificação do sistema... use / para comandos" }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    editorProps: {
      attributes: {
        class: "prose prose-invert prose-sm max-w-none focus:outline-none min-h-[400px]",
      },
    },
    onUpdate: () => {
      if (!carregouRef.current) return;
      setStatus("pendente");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(salvar, AUTOSAVE_DEBOUNCE_MS);
    },
  });

  useEffect(() => {
    async function carregar() {
      const res = await ListarDocumentosBlueprint(projectId);
      if (res.success && res.data && res.data.length > 0) {
        const doc = res.data[0];
        setDocumentId(doc.id);
        editor?.commands.setContent(JSON.parse(doc.contentJson));
      }
      carregouRef.current = true;
      setStatus("salvo");
    }
    if (editor) void carregar();
  }, [editor, projectId]);

  async function salvar() {
    if (!editor) return;
    setStatus("salvando");
    const contentJson = JSON.stringify(editor.getJSON());
    const contentText = editor.getText();

    const res = await SalvarDocumentoBlueprint({ projectId, documentId, contentJson, contentText, title: "Especificação" });
    if (res.success && res.data) {
      setDocumentId(res.data.id);
      setStatus("salvo");
    } else {
      setStatus("erro");
    }
  }

  if (!editor) return null;

  return (
    <div className="max-w-4xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0.5 rounded-xl border border-white/5 bg-slate-900/40 p-1">
          <ToolbarButton title="Título" ativo={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
            <Heading1 size={15} />
          </ToolbarButton>
          <ToolbarButton title="Subtítulo" ativo={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 size={15} />
          </ToolbarButton>
          <div className="w-px h-4 bg-white/10 mx-1" />
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
          <div className="w-px h-4 bg-white/10 mx-1" />
          <ToolbarButton title="Lista" ativo={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <List size={15} />
          </ToolbarButton>
          <ToolbarButton title="Lista numerada" ativo={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <ListOrdered size={15} />
          </ToolbarButton>
          <ToolbarButton title="Checklist" ativo={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}>
            <ListTodo size={15} />
          </ToolbarButton>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <ToolbarButton title="Citação" ativo={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <Quote size={15} />
          </ToolbarButton>
          <ToolbarButton title="Código" ativo={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
            <Code size={15} />
          </ToolbarButton>
          <ToolbarButton title="Tabela" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
            <TableIcon size={15} />
          </ToolbarButton>
        </div>

        <StatusIndicator status={status} accent={accent} />
      </div>

      <div className="rounded-2xl border border-white/5 bg-slate-950/70 backdrop-blur-2xl p-5">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function StatusIndicator({ status, accent }: { status: StatusSalvamento; accent: string }) {
  const config: Record<StatusSalvamento, { texto: string; cor: string }> = {
    carregando: { texto: "Carregando...", cor: "148,163,184" },
    salvando: { texto: "Salvando...", cor: accent },
    salvo: { texto: "Salvo", cor: "52,211,153" },
    pendente: { texto: "Alterações pendentes", cor: "251,191,36" },
    erro: { texto: "Erro ao salvar", cor: "248,113,113" },
  };
  const { texto, cor } = config[status];
  return (
    <span className="flex items-center gap-1.5 text-xs" style={{ color: `rgb(${cor})` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: `rgb(${cor})` }} />
      {texto}
    </span>
  );
}
