"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { FileText, FileAudio, FileVideo, File as FileIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ListarArquivosBlueprint, ExcluirArquivoBlueprint } from "@/actions/BlueprintFiles";
import { FileUploadDropzone } from "./FileUploadDropzone";

interface ArquivoBlueprint {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string | Date;
}

interface ProjectFilesProps {
  projectId: string;
  accent: string;
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function IconePorTipo({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("video/")) return <FileVideo size={18} className="text-purple-400" />;
  if (mimeType.startsWith("audio/")) return <FileAudio size={18} className="text-emerald-400" />;
  if (mimeType === "application/pdf") return <FileText size={18} className="text-rose-400" />;
  return <FileIcon size={18} className="text-slate-400" />;
}

export function ProjectFiles({ projectId, accent }: ProjectFilesProps) {
  const [arquivos, setArquivos] = useState<ArquivoBlueprint[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [paraExcluir, setParaExcluir] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await ListarArquivosBlueprint(projectId);
    if (res.success && res.data) setArquivos(res.data as unknown as ArquivoBlueprint[]);
    setCarregando(false);
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  async function confirmarExclusao() {
    if (!paraExcluir) return;
    const res = await ExcluirArquivoBlueprint(paraExcluir, projectId);
    if (res.success) {
      toast.success("Arquivo excluído");
      carregar();
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Erro ao excluir");
    }
    setParaExcluir(null);
  }

  return (
    <div className="max-w-4xl space-y-4">
      <FileUploadDropzone projectId={projectId} accent={accent} onEnviado={carregar} />

      {carregando ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      ) : arquivos.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">Nenhum arquivo enviado ainda</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {arquivos.map((arquivo) => (
            <div key={arquivo.id} className="group relative rounded-xl border border-white/5 bg-slate-900/40 p-3 space-y-2">
              {arquivo.mimeType.startsWith("image/") ? (
                <div className="relative w-full h-16 rounded-lg overflow-hidden bg-slate-950">
                  <Image src={arquivo.url} alt={arquivo.originalName} fill className="object-cover" unoptimized />
                </div>
              ) : (
                <div className="w-full h-16 rounded-lg bg-slate-950 flex items-center justify-center">
                  <IconePorTipo mimeType={arquivo.mimeType} />
                </div>
              )}
              <p className="text-[11px] text-slate-300 truncate" title={arquivo.originalName}>{arquivo.originalName}</p>
              <p className="text-[10px] text-slate-600">{formatarTamanho(arquivo.size)}</p>

              <button
                onClick={() => setParaExcluir(arquivo.id)}
                className="absolute top-1 right-1 p-1 rounded-lg bg-slate-950/80 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!paraExcluir} onOpenChange={(open) => !open && setParaExcluir(null)}>
        <AlertDialogContent className="bg-slate-950/95 border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Excluir arquivo?</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-slate-400">Esta ação não pode ser desfeita.</p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao} className="bg-rose-600 hover:bg-rose-700">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
