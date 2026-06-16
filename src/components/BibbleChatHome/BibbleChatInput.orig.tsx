"use client";

import { useCallback } from "react";
import { ArrowUp, Square, Paperclip, X, FileText, Image, Video, File } from "lucide-react";
import { type StreamStatus } from "./BibbleChatLayout";
import { cn } from "@/lib/utils";
import type { UploadedFile } from "./BibbleFileUpload";

interface BibbleChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  streamStatus?: StreamStatus;
  model?: string;
  disabled?: boolean;
  placeholder?: string;
  files?: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  showFiles: boolean;
  onToggleFiles: (show: boolean) => void;
}

export default function BibbleChatInput({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  streamStatus = "idle",
  model,
  disabled,
  placeholder = "Pergunte algo ao Bibble...",
  files = [],
  onFilesChange,
  showFiles,
  onToggleFiles,
}: BibbleChatInputProps) {
  const canSend = (value.trim().length > 0 || files.length > 0) && !isStreaming && !disabled;
  const filesReady = files.every(f => !f.uploading && !f.error);

  // Remover arquivo
  const removeFile = useCallback((id: string) => {
    const fileToRemove = files.find(f => f.id === id);
    if (fileToRemove?.previewUrl) {
      URL.revokeObjectURL(fileToRemove.previewUrl);
    }
    onFilesChange(files.filter(f => f.id !== id));
  }, [files, onFilesChange]);

  const handleSend = useCallback(() => {
    if (canSend) {
      onSend();
    }
  }, [canSend, onSend]);

  const modelShort = model ? model.split(":")[0] : null;
  const isAllUploadsFinished = files.length > 0 && files.every(f => !f.uploading && !f.error);

  const getFileIcon = (fileType: string) => {
    if (fileType.includes("image")) return <Image size={16} className="text-blue-400" />;
    if (fileType.includes("video")) return <Video size={16} className="text-purple-400" />;
    if (fileType.includes("pdf")) return <FileText size={16} className="text-red-400" />;
    if (fileType.includes("excel") || fileType.includes("spreadsheet")) return <File size={16} className="text-green-600" />;
    return <File size={16} className="text-gray-400" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="px-5 pb-5 pt-2">
      {/* Streaming status pill */}
      <div className={cn(
        "max-w-[720px] mx-auto mb-2 flex justify-center transition-all duration-300",
        streamStatus !== "idle" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"
      )}>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-card border border-border text-[10px] font-bold text-muted-foreground">
          <span className="inline-flex gap-0.5">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="w-1 h-1 rounded-full bg-blue-400/60 animate-bounce"
                style={{ animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </span>
          {streamStatus === "thinking" && <span>Pensando...</span>}
          {streamStatus === "pesquisando" && <span>Buscando...</span>}
        </div>
      </div>

      <div className="max-w-[720px] mx-auto">
        <div
          className={cn(
            "bg-card border border-border rounded-2xl px-4 pt-3 pb-2",
            "transition-all duration-200 shadow-xl shadow-black/20",
            "relative",
          )}
        >
          {/* Previews de arquivos */}
          {showFiles && files.length > 0 && (
            <div className="mb-3 space-y-2 animate-in slide-in-from-top-2 fade-in duration-200">
              {files.map((file) => (
                <div
                  key={file.id}
                  className={cn(
                    "group flex items-center gap-2 p-2 rounded-lg border",
                    file.uploading && !file.error ? "bg-yellow-50/10 border-yellow-500/30" :
                    file.error ? "bg-red-50/10 border-red-500/30" :
                    "bg-muted/30 border-border"
                  )}
                >
                  {file.previewUrl && file.file.type.includes("image") ? (
                    <div className="w-10 h-10 rounded bg-muted/50 overflow-hidden shrink-0">
                      <img
                        src={file.previewUrl}
                        alt={file.file.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          const fallback = (e.target as HTMLImageElement).parentElement?.querySelector("div");
                          if (fallback) {
                            (fallback as HTMLElement).classList.add("flex", "items-center", "justify-center");
                          }
                        }}
                      />
                    </div>
                  ) : file.previewUrl && file.file.type.includes("video") ? (
                    <div className="w-10 h-10 rounded bg-muted/50 overflow-hidden shrink-0">
                      <video src={file.previewUrl} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                      {getFileIcon(file.file.type)}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate" title={file.file.name}>
                      {file.file.name}
                    </p>
                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                      <span>{formatFileSize(file.file.size)}</span>
                      <span>{file.file.type.split("/")[1] || "arquivo"}</span>
                    </div>
                  </div>

                  {file.uploading && !file.error && (
                    <div className="w-4 h-4 border-2 border-brand-primary/50 border-t-brand-primary rounded-full animate-spin" />
                  )}

                  {file.error && (
                    <div className="flex items-center gap-1 text-red-400 text-[9px]">
                      <span>Falha</span>
                      <X size={10} />
                    </div>
                  )}

                  <button
                    onClick={() => removeFile(file.id)}
                    className="p-1 rounded-full bg-red-500/80 hover:bg-red-500 text-white opacity-50 group-hover:opacity-100 transition-opacity"
                    title="Remover arquivo"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Área de texto */}
          <div className="flex items-start gap-2">
            {/* Botão de anexar */}
            <button
              type="button"
              onClick={() => onToggleFiles(!showFiles)}
              disabled={isStreaming}
              className={cn(
                "p-2 rounded-lg transition-all duration-200 shrink-0",
                showFiles
                  ? "bg-brand-primary/10 text-brand-primary"
                  : "hover:bg-muted/50 text-muted-foreground hover:text-foreground",
                isStreaming && "opacity-50 cursor-not-allowed"
              )}
              title={showFiles ? "Esconder arquivos (Shift+P)" : "Anexar arquivo (Shift+P)"}
            >
              <Paperclip size={16} />
            </button>

            {/* Indicadores e botão de fechar */}
            <div className="flex items-center gap-2">
              {showFiles && !isStreaming && (
                <button
                  type="button"
                  onClick={() => onFilesChange([])}
                  title="Limpar todos os arquivos"
                >
                  <X size={12} className="text-muted-foreground hover:text-foreground" />
                </button>
              )}
              {files.length > 0 && !isStreaming && (
                <span className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full",
                  filesReady
                    ? "bg-green-500/10 text-green-500"
                    : isAllUploadsFinished
                    ? "bg-yellow-500/10 text-yellow-500"
                    : "bg-red-500/10 text-red-500"
                )}>
                  {files.filter(f => !f.uploading && !f.error).length}/{files.length} prontos
                </span>
              )}
              <span className="text-[9px] text-muted-foreground/40 select-none hidden sm:block">
                {isStreaming
                  ? "Esc para parar"
                  : filesReady
                    ? "Enter para enviar"
                    : files.length > 0
                    ? "Aguardando uploads..."
                    : "Shift+P para anexar"
                }
              </span>
            </div>
          </div>

          {/* Input de texto */}
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={isStreaming ? "..." : placeholder}
            disabled={disabled || isStreaming}
            className={cn(
              "w-full bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/50 resize-none outline-none leading-relaxed min-h-[22px] max-h-[200px] overflow-y-auto",
              "mt-2"
            )}
            rows={1}
          />

          {/* Footer com status do botao e modelos */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5 h-6">
              {modelShort && (
                <span className="text-[9px] text-muted-foreground/40 font-bold uppercase tracking-wider">
                  {modelShort}
                </span>
              )}
              {files.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className={cn(
                    "text-[9px] font-medium px-1.5 py-0.5 rounded",
                    files.every(f => !f.uploading && !f.error)
                      ? "bg-green-500/10 text-green-500"
                      : "bg-yellow-500/10 text-yellow-500"
                  )}>
                    {files.every(f => !f.uploading && !f.error)
                      ? "Pronto para enviar"
                      : `${files.every(f => !f.uploading) ? files.length : files.filter(f => !f.uploading && !f.error).length}/${files.length}`
                    }
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isStreaming ? (
                <button
                  onClick={onStop}
                  title="Parar (Esc)"
                  className="w-7 h-7 rounded-lg bg-destructive/10 border border-destructive/25 flex items-center justify-center text-destructive/80 hover:bg-destructive/20 hover:text-destructive transition-all"
                >
                  <Square size={11} fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  title="Enviar (Enter)"
                  className={cn(
                    "w-7 h-7 rounded-lg border flex items-center justify-center transition-all",
                    "bg-alpha-glow border-alpha text-alpha",
                    "hover:bg-alpha/20",
                    "disabled:opacity-20 disabled:cursor-not-allowed",
                    filesReady ? "" : "border-yellow-500/50"
                  )}
                >
                  <ArrowUp size={14} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Dica de atalho */}
        <div className="mt-2 text-center">
          <p className="text-[10px] text-muted-foreground/50">
            {showFiles
              ? "Shift+P para ocultar • Rolar para ver arquivos"
              : "Shift+P para anexar arquivo* • Enter para enviar"
            }
          </p>
          {isStreaming && (
            <p className="text-[10px] text-muted-foreground/50 mt-1">
              *Pressione Esc para cancelar
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
