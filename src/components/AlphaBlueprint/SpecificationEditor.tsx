"use client";

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
import {
  Bold, Italic, UnderlineIcon, Strikethrough, List, ListOrdered,
  ListTodo, Quote, Code, Table as TableIcon, Heading1, Heading2,
} from "lucide-react";
import { ListarDocumentosBlueprint, SalvarDocumentoBlueprint } from "@/actions/BlueprintDocuments";
import {
  guardarRascunhoDocumentoBlueprint,
  lerRascunhoDocumentoBlueprint,
  limparRascunhoDocumentoBlueprint,
  type RascunhoDocumentoBlueprint,
} from "@/lib/blueprint/documento-rascunho";

const AUTOSAVE_DEBOUNCE_MS = 1500;

interface SpecificationEditorProps {
  projectId: string;
  userId: number;
  accent: string;
}

type Documento = NonNullable<Awaited<ReturnType<typeof ListarDocumentosBlueprint>>["data"]>[number];

type StatusSalvamento = "carregando" | "salvo" | "salvando" | "pendente" | "erro" | "offline" | "conflito";

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

export function SpecificationEditor({ projectId, userId, accent }: SpecificationEditorProps) {
  const [status, setStatus] = useState<StatusSalvamento>("carregando");
  const [erro, setErro] = useState<string | null>(null);
  const [erroStorage, setErroStorage] = useState(false);
  const [documentoRemoto, setDocumentoRemoto] = useState<Documento | null>(null);
  const [resolvendo, setResolvendo] = useState(false);
  const [tentativaCarga, setTentativaCarga] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const carregouRef = useRef(false);
  const mountedRef = useRef(true);
  const conflitoRef = useRef(false);
  const draftRef = useRef<RascunhoDocumentoBlueprint | null>(null);
  const identidadeRef = useRef<{ documentId?: string; baseUpdatedAt?: string; creationKey?: string }>({});
  const salvamentoRef = useRef<Promise<boolean> | null>(null);
  const salvarRef = useRef<() => Promise<boolean>>(async () => false);
  const atualizarRef = useRef<() => void>(() => {});

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
    editable: false,
    onUpdate: () => atualizarRef.current(),
  });

  function guardar(draft: RascunhoDocumentoBlueprint, somenteSeProprio = false) {
    const anterior = somenteSeProprio ? draftRef.current ?? undefined : undefined;
    draftRef.current = draft;
    const guardado = guardarRascunhoDocumentoBlueprint(draft, anterior);
    if (mountedRef.current) setErroStorage(!guardado);
  }

  async function salvar(): Promise<boolean> {
    if (salvamentoRef.current) return salvamentoRef.current;
    if (!carregouRef.current || conflitoRef.current || !draftRef.current) return false;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const processar = async () => {
      while (draftRef.current && !conflitoRef.current) {
        if (!navigator.onLine) {
          if (mountedRef.current) setStatus("offline");
          return false;
        }
        const snapshot = { ...draftRef.current, ...identidadeRef.current };
        if (mountedRef.current) { setStatus("salvando"); setErro(null); }
        try {
          const resposta = await SalvarDocumentoBlueprint({
            projectId, documentId: snapshot.documentId, creationKey: snapshot.creationKey,
            baseUpdatedAt: snapshot.baseUpdatedAt, contentJson: snapshot.contentJson,
            contentText: snapshot.contentText, title: "Especificação",
          });
          if (!resposta.success) {
            if (resposta.error === "CONFLITO_DOCUMENTO") {
              conflitoRef.current = true;
              if ("data" in resposta && resposta.data && mountedRef.current) setDocumentoRemoto(resposta.data);
              if (mountedRef.current) setStatus("conflito");
            } else if (mountedRef.current) setStatus("erro");
            if (mountedRef.current) setErro(resposta.error);
            return false;
          }
          identidadeRef.current = { ...identidadeRef.current, documentId: resposta.data.id, baseUpdatedAt: new Date(resposta.data.updatedAt).toISOString() };
          if (mountedRef.current) setDocumentoRemoto(resposta.data);
          if (draftRef.current?.revision === snapshot.revision) {
            draftRef.current = null;
            limparRascunhoDocumentoBlueprint(userId, projectId, snapshot);
            if (mountedRef.current) { setStatus("salvo"); setErroStorage(false); }
          } else if (draftRef.current) {
            guardar({ ...draftRef.current, ...identidadeRef.current }, true);
            if (mountedRef.current) setStatus("pendente");
          }
          // O rascunho já está durável. Não iniciar outro request após sair do editor.
          if (!mountedRef.current) return !draftRef.current;
        } catch {
          if (mountedRef.current) { setStatus("erro"); setErro("Falha de conexão. O rascunho foi preservado; tente novamente."); }
          return false;
        }
      }
      return !draftRef.current;
    };
    const promise = processar().finally(() => { salvamentoRef.current = null; });
    salvamentoRef.current = promise;
    return promise;
  }

  useEffect(() => {
    salvarRef.current = salvar;
    atualizarRef.current = () => {
      if (!editor || !carregouRef.current) return;
      const revision = (draftRef.current?.revision ?? 0) + 1;
      const creationKey = identidadeRef.current.creationKey ?? crypto.randomUUID();
      identidadeRef.current.creationKey = creationKey;
      guardar({ userId, projectId, creationKey, ...identidadeRef.current, contentJson: JSON.stringify(editor.getJSON()), contentText: editor.getText(), revision, token: crypto.randomUUID() });
      setStatus(conflitoRef.current ? "conflito" : navigator.onLine ? "pendente" : "offline");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!conflitoRef.current) debounceRef.current = setTimeout(() => void salvarRef.current(), AUTOSAVE_DEBOUNCE_MS);
    };
  });

  useEffect(() => {
    if (!editor) return;
    let cancelado = false;
    carregouRef.current = false;
    editor.setEditable(false);
    async function carregar() {
      try {
        const resposta = await ListarDocumentosBlueprint(projectId);
        if (cancelado) return;
        if (!resposta.success) throw new Error(resposta.error);
        const recovered = lerRascunhoDocumentoBlueprint(userId, projectId);
        const remoto = resposta.data.find((doc) => doc.id === recovered?.documentId) ?? resposta.data[0] ?? null;
        setDocumentoRemoto(remoto);
        identidadeRef.current = recovered
          ? { documentId: recovered.documentId, baseUpdatedAt: recovered.baseUpdatedAt, creationKey: recovered.creationKey }
          : { documentId: remoto?.id, baseUpdatedAt: remoto ? new Date(remoto.updatedAt).toISOString() : undefined, creationKey: crypto.randomUUID() };
        draftRef.current = recovered;
        const contentJson = recovered?.contentJson ?? remoto?.contentJson ?? '{"type":"doc","content":[{"type":"paragraph"}]}';
        editor!.commands.setContent(JSON.parse(contentJson) as JSONContent);
        carregouRef.current = true;
        editor!.setEditable(true);
        const compativel = !recovered || (!remoto && !recovered.documentId)
          || (remoto?.id === recovered.documentId && new Date(remoto.updatedAt).toISOString() === recovered.baseUpdatedAt);
        conflitoRef.current = !compativel;
        setErro(null);
        setStatus(!compativel ? "conflito" : recovered ? "pendente" : "salvo");
        if (recovered && compativel) debounceRef.current = setTimeout(() => void salvarRef.current(), AUTOSAVE_DEBOUNCE_MS);
      } catch {
        if (cancelado) return;
        setStatus("erro");
        setErro("Não foi possível carregar a especificação. Seu rascunho local foi preservado.");
      }
    }
    void carregar();
    return () => { cancelado = true; };
  }, [editor, projectId, userId, tentativaCarga]);

  useEffect(() => {
    mountedRef.current = true;
    const online = () => { if (draftRef.current && !conflitoRef.current) void salvarRef.current(); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!draftRef.current) return;
      event.preventDefault(); event.returnValue = "";
    };
    window.addEventListener("online", online);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      window.removeEventListener("online", online);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, []);

  async function resolverConflito(manterLocal: boolean) {
    if (resolvendo) return;
    setResolvendo(true);
    editor?.setEditable(false);
    try {
      // Ao manter o rascunho, use a versão efetivamente apresentada ao usuário.
      // Uma nova alteração no servidor deve provocar outro conflito, nunca ser sobrescrita
      // apenas porque uma releitura encontrou uma base mais recente.
      let remoto = documentoRemoto;
      if (!manterLocal) {
        const resposta = await ListarDocumentosBlueprint(projectId);
        if (!resposta.success) throw new Error(resposta.error);
        remoto = resposta.data.find((doc) => doc.id === identidadeRef.current.documentId) ?? resposta.data[0] ?? null;
        setDocumentoRemoto(remoto);
      }
      identidadeRef.current = { ...identidadeRef.current, documentId: remoto?.id, baseUpdatedAt: remoto ? new Date(remoto.updatedAt).toISOString() : undefined };
      if (manterLocal && draftRef.current) {
        guardar({ ...draftRef.current, ...identidadeRef.current }, true);
        conflitoRef.current = false;
        setErro(null); setStatus("pendente");
        await salvarRef.current();
      } else if (!manterLocal) {
        editor?.commands.setContent(JSON.parse(remoto?.contentJson ?? '{"type":"doc"}') as JSONContent);
        const descartado = draftRef.current;
        draftRef.current = null;
        if (descartado) limparRascunhoDocumentoBlueprint(userId, projectId, descartado);
        conflitoRef.current = false;
        setErro(null); setStatus("salvo");
      }
    } catch { setErro("Não foi possível obter a versão atual. Seu rascunho continua preservado."); }
    finally { setResolvendo(false); editor?.setEditable(true); }
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

      {erroStorage && <p role="alert" className="text-xs text-amber-300">O navegador não permitiu guardar o rascunho local. Mantenha esta página aberta até a confirmação do servidor.</p>}
      {erro && <p role="alert" className="text-xs text-rose-300">{erro === "CONFLITO_DOCUMENTO" ? "O documento foi alterado em outra sessão. Seu texto foi preservado." : erro}</p>}
      {status === "conflito" && <div role="alert" className="space-y-2 rounded-xl border border-amber-400/30 p-3 text-xs text-amber-100">
        <p>Existe uma versão diferente no servidor. Escolha qual conteúdo deseja manter.</p>
        <details><summary className="cursor-pointer">Ver texto do servidor</summary><pre className="max-h-60 overflow-auto whitespace-pre-wrap p-2">{documentoRemoto?.contentText || "Documento sem texto."}</pre></details>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded border border-white/20 px-3 py-2" disabled={resolvendo} onClick={() => void resolverConflito(true)}>Salvar meu rascunho</button>
          <button type="button" className="rounded border border-white/20 px-3 py-2" disabled={resolvendo} onClick={() => void resolverConflito(false)}>Descartar rascunho e usar servidor</button>
        </div>
      </div>}
      {["erro", "offline", "pendente"].includes(status) && <button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-xs text-white" onClick={() => {
        if (!carregouRef.current) setTentativaCarga((value) => value + 1);
        else void salvarRef.current();
      }}>Tentar salvar novamente</button>}

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
    offline: { texto: "Sem conexão — rascunho pendente", cor: "251,191,36" },
    conflito: { texto: "Conflito de versão", cor: "251,191,36" },
  };
  const { texto, cor } = config[status];
  return (
    <span className="flex items-center gap-1.5 text-xs" style={{ color: `rgb(${cor})` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: `rgb(${cor})` }} />
      {texto}
    </span>
  );
}
