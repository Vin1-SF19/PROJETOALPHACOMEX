"use client";

import { useEditor } from "@tiptap/react";

import {
  criarExtensoesEditorNote,
  NoteEditorContent,
} from "@/components/Notas/NoteEditor/NoteEditorPrimitives";
import { desserializarScriptEtapa } from "@/lib/bpm/script-etapa";

export function ConteudoScriptEtapa({ script }: { script: string }) {
  const conteudo = desserializarScriptEtapa(script);
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: criarExtensoesEditorNote(""),
    content: conteudo.content,
    editorProps: {
      attributes: {
        class: "prose prose-invert prose-sm max-w-none focus:outline-none px-0 py-0 text-slate-300",
        "aria-label": "Script da etapa",
      },
    },
  });

  if (!editor) return null;
  return <NoteEditorContent editor={editor} className="overflow-visible" />;
}
