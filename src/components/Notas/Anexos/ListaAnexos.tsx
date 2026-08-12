"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Paperclip, Trash2, Loader2 } from "lucide-react";
import { RegistrarAnexoNota, ListarAnexosNota, ExcluirAnexoNota } from "@/actions/NotasAnexos";
import { NOTAS_ANEXO_MAX_SIZE } from "@/lib/validations/notas";
import { Skeleton } from "@/components/ui/skeleton";
import { AnexoPreviewModal } from "./AnexoPreviewModal";

interface AnexoListado {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: Date | string;
  uploadedBy: { id: number; nome: string };
}

interface ListaAnexosProps {
  noteId: string;
  accent?: string;
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ListaAnexos({ noteId, accent = "37, 99, 235" }: ListaAnexosProps) {
  const [anexos, setAnexos] = useState<AnexoListado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [anexoEmPreview, setAnexoEmPreview] = useState<AnexoListado | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function carregar() {
    const res = await ListarAnexosNota(noteId);
    if (res.success) setAnexos(res.data);
    setCarregando(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCarregando(true);
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  async function enviarArquivo(file: File) {
    if (file.size > NOTAS_ANEXO_MAX_SIZE) {
      toast.error(`Arquivo muito grande. Máximo: ${NOTAS_ANEXO_MAX_SIZE / 1024 / 1024}MB`);
      return;
    }

    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("noteId", noteId);

      const resposta = await fetch("/api/notas/upload", { method: "POST", body: formData });
      const resultado = await resposta.json();

      if (!resultado.success) {
        toast.error(resultado.error ?? "Não foi possível enviar o arquivo");
        return;
      }

      const resRegistro = await RegistrarAnexoNota({
        noteId,
        fileName: resultado.fileName,
        mimeType: resultado.mimeType,
        size: resultado.size,
        storageKey: resultado.storageKey,
      });

      if (!resRegistro.success) {
        toast.error(resRegistro.error ?? "Não foi possível registrar o anexo");
        return;
      }

      toast.success("Arquivo anexado");
      await carregar();
    } catch {
      toast.error("Erro ao enviar arquivo");
    } finally {
      setEnviando(false);
    }
  }

  async function excluir(attachmentId: string) {
    const res = await ExcluirAnexoNota(attachmentId);
    if (!res.success) {
      toast.error(res.error ?? "Não foi possível excluir o anexo");
      return;
    }
    await carregar();
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wide text-slate-600">Anexos</p>
        <button
          type="button"
          disabled={enviando}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] text-slate-400 hover:bg-white/5 hover:text-white"
        >
          {enviando ? <Loader2 size={11} className="animate-spin" /> : <Paperclip size={11} />}
          Anexar
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void enviarArquivo(file);
            event.target.value = "";
          }}
        />
      </div>

      <div className="flex flex-col gap-1">
        {carregando && (
          <>
            <Skeleton className="h-7 w-full rounded-lg" />
            <Skeleton className="h-7 w-4/5 rounded-lg" />
          </>
        )}
        {!carregando && anexos.map((anexo) => (
          <div key={anexo.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5 text-xs">
            <button
              type="button"
              onClick={() => setAnexoEmPreview(anexo)}
              className="flex min-w-0 items-center gap-1.5 text-left text-slate-300 hover:text-white"
            >
              <Paperclip size={11} className="shrink-0" />
              <span className="truncate">{anexo.fileName}</span>
              <span className="shrink-0 text-[10px] text-slate-600">{formatarTamanho(anexo.size)}</span>
            </button>
            <button type="button" onClick={() => void excluir(anexo.id)} className="shrink-0 text-slate-600 hover:text-rose-400">
              <Trash2 size={11} />
            </button>
          </div>
        ))}
        {!carregando && anexos.length === 0 && <p className="text-xs text-slate-600">Nenhum anexo ainda.</p>}
      </div>

      <AnexoPreviewModal anexo={anexoEmPreview} onFechar={() => setAnexoEmPreview(null)} accent={accent} />
    </div>
  );
}
