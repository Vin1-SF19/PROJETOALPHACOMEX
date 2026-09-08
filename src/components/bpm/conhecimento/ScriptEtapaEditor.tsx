"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor } from "@tiptap/react";
import { toast } from "sonner";

import { SalvarScriptEtapaBpm } from "@/actions/bpm/Conhecimento";
import {
  criarExtensoesEditorNote,
  NoteEditorContent,
  NoteEditorToolbar,
} from "@/components/Notas/NoteEditor/NoteEditorPrimitives";
import { desserializarScriptEtapa, serializarScriptEtapa } from "@/lib/bpm/script-etapa";

const AUTOSAVE_DEBOUNCE_MS = 1_500;
type EstadoSalvamento = "salvo" | "pendente" | "salvando" | "erro";

const rotulosEstado: Record<EstadoSalvamento, string> = {
  salvo: "Salvo",
  pendente: "Alterações pendentes",
  salvando: "Salvando...",
  erro: "Falha ao salvar",
};

const coresEstado: Record<EstadoSalvamento, string> = {
  salvo: "text-emerald-500",
  pendente: "text-amber-500",
  salvando: "text-blue-400",
  erro: "text-rose-500",
};

interface Props {
  pipelineId: string;
  etapaId: string;
  scriptInicial: string | null;
  onSalvo: (script: string | null) => void;
  onEstadoChange: (bloqueado: boolean) => void;
}

export function ScriptEtapaEditor({ pipelineId, etapaId, scriptInicial, onSalvo, onEstadoChange }: Props) {
  const [estado, setEstado] = useState<EstadoSalvamento>("salvo");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contextoRef = useRef({ pipelineId, etapaId });
  const montadoRef = useRef(false);
  const revisaoRef = useRef(0);
  const inicial = desserializarScriptEtapa(scriptInicial);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: criarExtensoesEditorNote("Escreva o script... use / para comandos"),
    content: inicial.content,
    editorProps: {
      attributes: {
        class: "prose prose-invert prose-sm max-w-none focus:outline-none min-h-[260px] px-4 py-3",
        "aria-label": "Texto do script da etapa",
      },
    },
    onUpdate: ({ editor: editorAtual }) => {
      if (!montadoRef.current) return;
      const revisao = ++revisaoRef.current;
      setEstado("pendente");
      onEstadoChange(true);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setEstado("salvando");
        try {
          const script = serializarScriptEtapa(editorAtual.getJSON(), editorAtual.getText());
          const contexto = contextoRef.current;
          const resposta = await SalvarScriptEtapaBpm({ ...contexto, script });
          if (!montadoRef.current || revisao !== revisaoRef.current) return;
          if (!resposta.success) {
            setEstado("erro");
            onEstadoChange(false);
            toast.error(resposta.error);
            return;
          }
          onSalvo(script);
          setEstado("salvo");
          onEstadoChange(false);
        } catch (error) {
          if (!montadoRef.current || revisao !== revisaoRef.current) return;
          setEstado("erro");
          onEstadoChange(false);
          toast.error(error instanceof Error ? error.message : "Não foi possível salvar o script");
        }
      }, AUTOSAVE_DEBOUNCE_MS);
    },
  });

  useEffect(() => {
    contextoRef.current = { pipelineId, etapaId };
  }, [etapaId, pipelineId]);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (!editor) return <div className="min-h-[300px] animate-pulse rounded-2xl bg-white/[0.03]" />;

  return (
    <div className="flex min-h-[340px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/40">
      <NoteEditorToolbar
        editor={editor}
        status={<span aria-live="polite" className={coresEstado[estado]}>{rotulosEstado[estado]}</span>}
      />
      <NoteEditorContent editor={editor} />
    </div>
  );
}
