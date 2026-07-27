"use client";

import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RegistrarArquivoBlueprint } from "@/actions/BlueprintFiles";

interface FileUploadDropzoneProps {
  projectId: string;
  accent: string;
  onEnviado: () => void;
}

export function FileUploadDropzone({ projectId, accent, onEnviado }: FileUploadDropzoneProps) {
  const [enviando, setEnviando] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function enviarArquivo(file: File) {
    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);

      const resp = await fetch("/api/blueprint/upload", { method: "POST", body: formData });
      const data = await resp.json();

      if (!resp.ok || !data.success) {
        toast.error(data.error ?? "Erro ao enviar arquivo");
        return;
      }

      const registro = await RegistrarArquivoBlueprint({
        projectId,
        name: data.file.name,
        originalName: data.file.originalName,
        mimeType: data.file.mimeType,
        size: data.file.size,
        url: data.file.url,
      });

      if (registro.success) {
        toast.success("Arquivo enviado");
        onEnviado();
      } else {
        toast.error(typeof registro.error === "string" ? registro.error : "Erro ao registrar arquivo");
      }
    } catch {
      toast.error("Erro ao enviar arquivo");
    } finally {
      setEnviando(false);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => enviarArquivo(file));
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
      onDragLeave={() => setArrastando(false)}
      onDrop={(e) => { e.preventDefault(); setArrastando(false); handleFiles(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
      className="rounded-2xl border-2 border-dashed p-8 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
      style={{ borderColor: arrastando ? `rgba(${accent},0.5)` : "rgba(255,255,255,0.1)" }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        onPaste={(e) => handleFiles(e.clipboardData.files)}
      />
      {enviando ? (
        <Loader2 size={24} className="animate-spin text-slate-400" />
      ) : (
        <Upload size={24} className="text-slate-500" />
      )}
      <p className="text-sm text-slate-400">Arraste arquivos ou clique para selecionar</p>
      <p className="text-xs text-slate-600">Imagens, vídeos, PDFs, áudios e documentos até 100MB</p>
    </div>
  );
}
