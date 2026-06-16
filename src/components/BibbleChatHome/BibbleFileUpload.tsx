"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { Upload, X, Image, FileText, Video, File, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UploadedFile {
  id: string;
  file: File;
  previewUrl?: string;
  uploadUrl?: string;
  extractedContent?: string;
  uploading: boolean;
  error?: string;
}

interface BibbleFileUploadProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  maxFileSize: number;
  maxFiles: number;
}

const ALLOWED_TYPES = {
  image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
  video: ["video/mp4", "video/webm", "video/x-matroska"],
  document: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/plain", "text/csv", "application/json"],
  archive: ["application/zip", "application/x-zip-compressed"],
};

const SIZE_DISPLAY = {
  image: "200KB",
  video: "5MB",
  document: "10MB",
  archive: "10MB",
};

const MAX_DISPLAY = {
  image: "unlimited",
  video: "3",
  document: "10",
  archive: "5",
};

export function BibbleFileUpload({ files, onFilesChange, maxFileSize, maxFiles }: BibbleFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(async (newFiles: File[]) => {
    const uploaded: UploadedFile[] = [];
    const errors: UploadedFile[] = [];

    for (const file of newFiles) {
      // Verificar tamanho
      if (file.size > maxFileSize) {
        errors.push({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          file,
          uploading: false,
          error: `Arquivo muito grande. Máx: ${formatFileSize(maxFileSize)}`,
        });
        continue;
      }

      // Verificar tipo
      const isValidType = Object.values(ALLOWED_TYPES).flat().includes(file.type);
      if (!isValidType) {
        errors.push({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          file,
          uploading: false,
          error: "Tipo de arquivo não permitido",
        });
        continue;
      }

      // Criar URL de preview
      const previewUrl = URL.createObjectURL(file);

      uploaded.push({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        previewUrl,
        uploading: true,
        error: undefined,
      });
    }

    let newFilesList = [...files, ...uploaded];

    // Remover arquivos com erro
    if (errors.length > 0) {
      newFilesList = [...files];
    }

    onFilesChange(newFilesList);

    // Processar uploads
    if (uploaded.length > 0) {
      await uploadFiles(uploaded);
    }
  }, [files, maxFileSize, maxFiles, onFilesChange]);

  const uploadFiles = async (filesToUpload: UploadedFile[]) => {
    const results: Array<{ id: string; success: boolean }> = [];

    // Upload em paralelo para o endpoint específico do Bibble Chat
    await Promise.all(
      filesToUpload.map(async (item) => {
        try {
          const formData = new FormData();
          formData.append("file", item.file);
          formData.append("size", item.file.size.toString());

          const uploadResponse = await fetch("/api/bibble/upload-to-blob", {
            method: "POST",
            body: formData,
          });

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(errorText || "Upload failed");
          }

          const data = await uploadResponse.json();

          if (data.success && data.file) {
            // Update with upload URL and extracted content (for PDFs/text files)
            const fileWithUrl = {
              ...item,
              uploading: false,
              uploadUrl: data.file.url,
              extractedContent: data.file.extractedContent as string | undefined,
            };

            results.push({ id: item.id, success: true });
            onFilesChange(
              files.map(f => f.id === item.id ? fileWithUrl : f)
            );

            console.log(`[BIBBLE UPLOAD] File uploaded: ${fileWithUrl.file.name} -> ${data.file.url}`);
          } else {
            throw new Error(data.error || "Upload failed");
          }
        } catch (error) {
          console.error(`Upload failed for ${item.file.name}:`, error);
          results.push({ id: item.id, success: false });
          onFilesChange(
            files.map(f => f.id === item.id ? { ...f, uploading: false, error: "Falha ao upload" } : f)
          );
        }
      })
    );
  };

  const removeFile = useCallback((id: string) => {
    const fileToRemove = files.find(f => f.id === id);
    if (fileToRemove?.previewUrl) {
      URL.revokeObjectURL(fileToRemove.previewUrl);
    }
    onFilesChange(files.filter(f => f.id !== id));
  }, [files, onFilesChange]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  }, [handleFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    handleFiles(selectedFiles);
    // Reset input para permitir selecionrar o mesmo arquivo novamente
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [handleFiles]);

  const getFileIcon = (fileType: string, fileName: string) => {
    if (fileType.includes("image")) return <Image size={24} className="text-blue-400" />;
    if (fileType.includes("video")) return <Video size={24} className="text-purple-400" />;
    if (fileType.includes("pdf")) return <FileText size={24} className="text-red-400" />;
    if (fileType.includes("word")) return <FileText size={24} className="text-blue-600" />;
    if (fileType.includes("excel") || fileType.includes("spreadsheet")) return <FileText size={24} className="text-green-600" />;
    if (fileType.includes("plain") || fileType.includes("csv") || fileType.includes("json")) return <FileText size={24} className="text-gray-400" />;
    if (fileType.includes("zip") || fileType.includes("archive")) return <File size={24} className="text-orange-400" />;
    return <File size={24} className="text-gray-400" />;
  };

  const getFileTypeLabel = (fileType: string) => {
    if (fileType.includes("image")) return "Imagem";
    if (fileType.includes("video")) return "Vídeo";
    if (fileType.includes("pdf")) return "PDF";
    if (fileType.includes("word")) return "Documento Word";
    if (fileType.includes("excel")) return "Planilha Excel";
    return "Arquivo";
  };

  const getFileCountLabel = () => {
    const total = files.length;
    const totalSpace = files.reduce((acc, f) => acc + f.file.size, 0);
    return `${total} arquivo(s) (${formatFileSize(totalSpace)})`;
  };

  return (
    <div className="space-y-3">
      {/* Área de drag & drop */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all duration-200",
          isDragging
            ? "border-brand-primary bg-brand-primary/5"
            : "border-border hover:border-brand-primary/50 hover:bg-brand-primary/5"
        )}
      >
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Upload size={16} />
          <span>Clique ou arraste arquivos aqui</span>
        </div>
        <p className="text-xs text-muted-foreground/60 mt-1 text-center">
          Máx {formatFileSize(maxFileSize)} • Imagens, vídeos, PDFs, planilhas, arquivos de texto
        </p>
      </div>

      {/* Lista de arquivos selecionados */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{getFileCountLabel()}</span>
            <span className="opacity-60">Arraste para remover</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {files.map((item) => (
              <div
                key={item.id}
                className="group relative bg-card border border-border rounded-lg p-3 hover:border-brand-primary/50 transition-colors"
              >
                {/* Preview */}
                {item.previewUrl && item.file.type.includes("image") ? (
                  <div className="relative aspect-square mb-2 rounded-lg overflow-hidden bg-muted/50">
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    {!item.uploadUrl && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white/50 border-t-white animate-spin rounded-full" />
                      </div>
                    )}
                  </div>
                ) : item.previewUrl && item.file.type.includes("video") ? (
                  <div className="relative aspect-video mb-2 rounded-lg overflow-hidden bg-black/50">
                    <video
                      src={item.previewUrl}
                      className="w-full h-full object-cover"
                      muted
                      onError={(e) => {
                        (e.target as HTMLVideoElement).style.display = "none";
                      }}
                    />
                    {!item.uploadUrl && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white/50 border-t-white animate-spin rounded-full" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={cn(
                    "aspect-square rounded-lg mb-2 flex items-center justify-center",
                    item.uploading ? "bg-muted/50" : "bg-muted/30"
                  )}>
                    {getFileIcon(item.file.type, item.file.name)}
                  </div>
                )}

                {/* Info do arquivo */}
                <div className="space-y-1">
                  <p className="text-xs font-medium truncate" title={item.file.name}>
                    {item.file.name}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-primary/10 text-brand-primary">
                      {getFileTypeLabel(item.file.type)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatFileSize(item.file.size)}
                    </span>
                  </div>
                </div>

                {/* Upload status / Error */}
                {item.uploading ? (
                  <div className="absolute top-1 right-1">
                    <div className="w-4 h-4 border-2 border-brand-primary/50 border-t-brand-primary rounded-full animate-spin" />
                  </div>
                ) : item.error ? (
                  <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center rounded-lg backdrop-blur-sm">
                    <div className="flex items-center gap-1 text-xs text-red-400 px-2 py-1 bg-red-500/20 rounded">
                      <AlertCircle size={12} />
                      <span>{item.error}</span>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => removeFile(item.id)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-red-500/80 hover:bg-red-500 text-white transition-opacity opacity-0 group-hover:opacity-100"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input escondido */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.json,.zip"
        className="hidden"
        onChange={handleFileInput}
      />
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
