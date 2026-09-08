"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, type JSONContent } from "@tiptap/react";
import { Lock, ChevronLeft, SlidersHorizontal } from "lucide-react";
import { AtualizarNota } from "@/actions/Notas";
import { useNotasWorkspace } from "@/store/useNotasWorkspace";
import { getNotaRascunhoStorageKey } from "@/lib/notas-tabs";
import { cn } from "@/lib/utils";
import {
  criarExtensoesEditorNote,
  NoteEditorContent,
  NoteEditorToolbar,
} from "@/components/Notas/NoteEditor/NoteEditorPrimitives";

const AUTOSAVE_DEBOUNCE_MS = 1500;

interface NoteEditorProps {
  noteId: string;
  initialTitle: string;
  initialContentJson: JSONContent;
  initialVersion: number;
  onPreviewChange?: (preview: { noteId: string; title: string; plainText: string }) => void;
  somenteLeitura?: boolean;
  /** Só fornecido pela Central de Notas — mostra a barra superior mobile com "← Voltar" para a
   *  lista. Ausente no NoteViewer flutuante da barra global, que não tem "lista" para voltar. */
  onVoltarMobile?: () => void;
  /** Idem: abre o painel de propriedades como bottom sheet no mobile (< lg). */
  onAbrirAcoesMobile?: () => void;
}

type StatusSalvamento = "salvo" | "pendente" | "salvando" | "erro" | "conflito" | "offline";

export function NoteEditor({
  noteId,
  initialTitle,
  initialContentJson,
  initialVersion,
  onPreviewChange,
  somenteLeitura = false,
  onVoltarMobile,
  onAbrirAcoesMobile,
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
    editable: !somenteLeitura,
    extensions: criarExtensoesEditorNote(
      somenteLeitura ? "" : "Escreva sua nota... use / para comandos",
    ),
    content: initialContentJson ?? "",
    editorProps: {
      attributes: {
        class: "prose prose-invert prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3",
      },
    },
    onUpdate: ({ editor }) => {
      // Defesa em profundidade: com editable=false o Tiptap não deveria disparar onUpdate por
      // digitação, mas o autosave nunca pode rodar para quem só tem permissão de leitura —
      // o servidor já recusa (AtualizarNota → podeEditarNota), isto apenas evita o round-trip.
      if (somenteLeitura) return;
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
    editor?.setEditable(!somenteLeitura);
  }, [editor, somenteLeitura]);

  useEffect(() => {
    if (!editor) return;
    // Rascunho local pode ter sido salvo enquanto o usuário ainda tinha permissão de edição —
    // restaurar por cima do conteúdo servido agora que ele é somente-leitura mostraria uma
    // versão que nunca chegou a ser gravada no servidor.
    if (somenteLeitura) {
      carregouRef.current = true;
      return;
    }

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
      {onVoltarMobile && (
        <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-2 py-1.5 lg:hidden">
          <button
            type="button"
            onClick={onVoltarMobile}
            className="flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-300 hover:bg-white/5 hover:text-white"
          >
            <ChevronLeft size={16} /> Notas
          </button>
          {onAbrirAcoesMobile && (
            <button
              type="button"
              onClick={onAbrirAcoesMobile}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-xs font-semibold text-slate-300 hover:bg-white/5 hover:text-white"
            >
              <SlidersHorizontal size={13} /> Ações
            </button>
          )}
        </div>
      )}

      {somenteLeitura ? (
        <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-amber-400 sm:px-4">
          <Lock size={12} className="shrink-0" />
          <span className="truncate">Somente leitura — você não tem permissão para editar esta nota</span>
        </div>
      ) : (
        <NoteEditorToolbar editor={editor} status={<StatusIndicador status={status} />} />
      )}

      <input
        value={title}
        readOnly={somenteLeitura}
        onChange={(event) => {
          if (somenteLeitura) return;
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
        className={cn(
          "w-full border-b border-white/5 bg-transparent px-4 py-2 text-sm font-semibold text-white outline-none placeholder:text-slate-600",
          somenteLeitura && "cursor-default text-slate-300",
        )}
      />

      <NoteEditorContent editor={editor} />
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
