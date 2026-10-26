"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, type JSONContent } from "@tiptap/react";
import { Lock, ChevronLeft, SlidersHorizontal } from "lucide-react";
import { AtualizarNota, ObterNota } from "@/actions/Notas";
import { useNotasWorkspace } from "@/store/useNotasWorkspace";
import { getNotaRascunhoStorageKey } from "@/lib/notas-tabs";
import { cn } from "@/lib/utils";
import { SalvamentoNota, registrarRenomeacaoEditor, type EstadoSalvamentoNota } from "@/lib/notas/salvamento-client";
import {
  criarExtensoesEditorNote,
  NoteEditorContent,
  NoteEditorToolbar,
} from "@/components/Notas/NoteEditor/NoteEditorPrimitives";

const AUTOSAVE_DEBOUNCE_MS = 1500;

interface NoteEditorProps {
  noteId: string;
  usuarioAtualId?: number;
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

type StatusSalvamento = EstadoSalvamentoNota;

export function NoteEditor({
  noteId,
  usuarioAtualId = 0,
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
  const titleRef = useRef(initialTitle);
  const onPreviewChangeRef = useRef(onPreviewChange);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const carregouRef = useRef(false);
  const [erroRecuperacao, setErroRecuperacao] = useState<string | null>(null);
  const [resolvendoConflito, setResolvendoConflito] = useState(false);
  const setSyncState = useNotasWorkspace((state) => state.setSyncState);
  const renomearAba = useNotasWorkspace((state) => state.renomearAba);
  const tabs = useNotasWorkspace((state) => state.tabs);
  const [session] = useState(() => new SalvamentoNota({
    noteId, version: initialVersion,
    content: { title: initialTitle, contentJson: initialContentJson, plainText: "" },
    storageKey: getNotaRascunhoStorageKey(noteId, usuarioAtualId),
    storage: () => usuarioAtualId > 0 ? localStorage : { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    online: () => navigator.onLine,
    update: AtualizarNota,
  }));

  const editor = useEditor({
    immediatelyRender: false,
    editable: !somenteLeitura,
    extensions: criarExtensoesEditorNote(somenteLeitura ? "" : "Escreva sua nota... use / para comandos"),
    content: initialContentJson ?? "",
    editorProps: { attributes: { class: "prose prose-invert prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3" } },
    onUpdate: ({ editor }) => {
      if (somenteLeitura || !carregouRef.current) return;
      if (!tituloEditadoManualmente && !titleRef.current.trim()) {
        const titulo = editor.getText().trim().slice(0, 60);
        if (titulo) { titleRef.current = titulo; setTitle(titulo); }
      }
      session.change({ title: titleRef.current, contentJson: editor.getJSON(), plainText: editor.getText() });
      onPreviewChangeRef.current?.({ noteId, title: titleRef.current, plainText: editor.getText() });
      agendarSalvamento();
    },
  });

  function agendarSalvamento() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void session.save(); }, AUTOSAVE_DEBOUNCE_MS);
  }
  function editarTitulo(novoTitulo: string) {
    if (somenteLeitura || !editor) return;
    setTitle(novoTitulo); titleRef.current = novoTitulo; setTituloEditadoManualmente(true);
    session.change({ title: novoTitulo, contentJson: editor.getJSON(), plainText: editor.getText() });
    onPreviewChangeRef.current?.({ noteId, title: novoTitulo, plainText: editor.getText() });
    for (const tab of tabs) if (tab.noteId === noteId) renomearAba(tab.id, novoTitulo);
  }
  async function resolverConflito(manterRascunho: boolean) {
    if (resolvendoConflito) return;
    setResolvendoConflito(true); setErroRecuperacao(null);
    try {
      const result = await ObterNota(noteId);
      if (!result.success || !result.data || result.somenteLeitura) {
        setErroRecuperacao(!result.success ? result.error : "Você não tem permissão para editar esta nota.");
        return;
      }
      if (manterRascunho) {
        session.keepDraftOnVersion(result.data.currentVersion);
        await session.save();
      } else {
        const conteudo = (result.data.contentJson ?? {}) as JSONContent;
        carregouRef.current = false;
        editor?.commands.setContent(conteudo);
        carregouRef.current = true;
        setTitle(result.data.title); titleRef.current = result.data.title;
        session.useRemote({ title: result.data.title, contentJson: conteudo, plainText: result.data.plainText }, result.data.currentVersion);
        onPreviewChangeRef.current?.({noteId, title: result.data.title, plainText: result.data.plainText});
        for (const tab of tabs) if (tab.noteId === noteId) renomearAba(tab.id, result.data.title);
      }
    } catch {
      setErroRecuperacao("Não foi possível consultar a versão salva. Seu rascunho foi mantido.");
    } finally { setResolvendoConflito(false); }
  }

  useEffect(() => { onPreviewChangeRef.current = onPreviewChange; }, [onPreviewChange]);
  useEffect(() => { editor?.setEditable(!somenteLeitura); }, [editor, somenteLeitura]);
  useEffect(() => session.subscribe((next) => { setStatus(next); setSyncState(noteId, next); }), [session, noteId, setSyncState]);
  useEffect(() => {
    if (!editor) return;
    carregouRef.current = false;
    if (!somenteLeitura) {
      const draft = session.restore();
      if (draft) {
        editor.commands.setContent(draft.contentJson as JSONContent);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restaura estado a partir do armazenamento externo ao montar
        setTitle(draft.title);
        titleRef.current = draft.title;
        onPreviewChangeRef.current?.({noteId, title:draft.title, plainText:draft.plainText});
        if (!session.hasConflict) agendarSalvamento();
      }
    }
    carregouRef.current = true;
    return () => { carregouRef.current = false; if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a restauração ocorre uma vez por editor/nota
  }, [editor]);
  useEffect(() => {
    if (somenteLeitura) return;
    const online = () => { if (session.pending) void session.save(); };
    const beforeUnload = (event: BeforeUnloadEvent) => { if (session.pending) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", beforeUnload);
    return () => { window.removeEventListener("online", online); window.removeEventListener("beforeunload", beforeUnload); };
  }, [session, somenteLeitura]);
  useEffect(() => registrarRenomeacaoEditor(noteId, async (titulo) => {
    if (somenteLeitura || !editor) return false;
    editarTitulo(titulo);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    return session.save();
  }, () => somenteLeitura ? Promise.resolve(!session.pending) : session.save()));

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
        onChange={(event) => { editarTitulo(event.target.value); agendarSalvamento(); }}
        placeholder="Sem título"
        className={cn(
          "w-full border-b border-white/5 bg-transparent px-4 py-2 text-sm font-semibold text-white outline-none placeholder:text-slate-600",
          somenteLeitura && "cursor-default text-slate-300",
        )}
      />

      {!somenteLeitura && ["erro", "offline"].includes(status) && (
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2 text-xs text-amber-300" role="alert">
          <span>O conteúdo continua pendente. Mantenha esta nota aberta ou reabra para recuperar o rascunho.</span>
          <button type="button" onClick={() => void session.save()} className="shrink-0 rounded border border-white/20 px-2 py-1">Tentar novamente</button>
        </div>
      )}
      {!somenteLeitura && status === "conflito" && (
        <div className="space-y-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200" role="alert">
          <p>Há outra versão salva. O texto exibido é seu rascunho. Escolha qual versão manter antes de salvar.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={resolvendoConflito} onClick={() => void resolverConflito(false)} className="rounded border border-white/20 px-2 py-1">Descartar rascunho e carregar versão salva</button>
            <button type="button" disabled={resolvendoConflito} onClick={() => void resolverConflito(true)} className="rounded border border-white/20 px-2 py-1">Salvar meu rascunho sobre a versão atual</button>
          </div>
          {erroRecuperacao && <p>{erroRecuperacao}</p>}
        </div>
      )}
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
    offline: "Sem conexão — alterações pendentes",
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
