"use client";

import { useCallback, useRef, useState } from "react";
import { ArrowUp, Square, Paperclip, X, FileText, Image, Video, File, Palette, ChevronDown, Check } from "lucide-react";
import { type StreamStatus } from "./BibbleChatLayout";
import { cn } from "@/lib/utils";
import type { UploadedFile } from "./BibbleFileUpload";
import { type TemaAlpha } from "@/lib/temas";
import { BotaoMicrofone } from "./BotaoMicrofone";
import {
  fetchImageModels, setDefaultImageModel, imageModelLabel, detectsImageIntent,
  type OnyxImageModel,
} from "@/lib/onyx/browser";

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
  onSelectFiles?: (files: File[]) => void;
  tema?: TemaAlpha;
  isAdmin?: boolean;
  /** true quando o agente ativo tem a skill de geração de imagem */
  imageGenAvailable?: boolean;
  /** Chamado quando o texto foi ditado por voz (para falar a resposta automaticamente) */
  onVozUsada?: () => void;
}

const CHAR_COUNTER_THRESHOLD = 800;

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
  onSelectFiles,
  tema,
  isAdmin,
  imageGenAvailable,
  onVozUsada,
}: BibbleChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  // ── Seletor de modelo de imagem (default GLOBAL no Onyx, admin only) ──
  const [imgModels, setImgModels] = useState<OnyxImageModel[] | null>(null);
  const [imgOpen, setImgOpen] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);

  const openImgMenu = () => {
    setImgOpen(o => !o);
    if (imgModels === null) {
      fetchImageModels().then(setImgModels).catch(() => setImgModels([]));
    }
  };
  const pickImgModel = async (id: string) => {
    setImgBusy(true);
    try {
      await setDefaultImageModel(id);
      setImgModels(prev => prev?.map(m => ({ ...m, is_default: m.image_provider_id === id })) ?? prev);
    } catch { /* ignore */ } finally {
      setImgBusy(false);
      setImgOpen(false);
    }
  };
  const currentImgModel = imgModels?.find(m => m.is_default);
  const showImageSelector = !!imageGenAvailable && !!isAdmin && !isStreaming && detectsImageIntent(value);
  const canSend = (value.trim().length > 0 || files.length > 0) && !isStreaming && !disabled;
  const filesReady = files.every(f => !f.uploading && !f.error);
  const isAllUploadsFinished = files.length > 0 && files.every(f => !f.uploading && !f.error);

  const removeFile = useCallback((id: string) => {
    const fileToRemove = files.find(f => f.id === id);
    if (fileToRemove?.previewUrl) URL.revokeObjectURL(fileToRemove.previewUrl);
    onFilesChange(files.filter(f => f.id !== id));
  }, [files, onFilesChange]);

  const handleSend = useCallback(() => {
    if (canSend) onSend();
  }, [canSend, onSend]);

  const getFileIcon = (fileType: string) => {
    if (fileType.includes("image")) return <Image size={16} className="text-indigo-400" />;
    if (fileType.includes("video")) return <Video size={16} className="text-violet-400" />;
    if (fileType.includes("pdf")) return <FileText size={16} className="text-sky-400" />;
    if (fileType.includes("excel") || fileType.includes("spreadsheet")) return <File size={16} className="text-emerald-500" />;
    return <File size={16} className="text-slate-400" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const ac = tema?.accent ?? "99, 102, 241";
  const borderColor = focused
    ? `rgba(${ac}, 0.7)`
    : `rgba(${ac}, 0.2)`;
  const focusShadow = focused
    ? `0 0 0 3px rgba(${ac}, 0.15), 0 4px 20px rgba(0,0,0,0.3)`
    : "0 4px 20px rgba(0,0,0,0.2)";

  return (
    <div className="px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
      {/* Streaming status pill */}
      <div className={cn(
        "max-w-[580px] mx-auto mb-2 flex justify-center transition-all duration-300",
        streamStatus !== "idle" ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"
      )}>
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full"
          style={{
            background: `rgba(${ac}, 0.12)`,
            border: `1px solid rgba(${ac}, 0.35)`,
            boxShadow: `0 0 10px rgba(${ac}, 0.2)`,
          }}
        >
          <div className="flex gap-0.5">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: `rgba(${ac}, 0.9)`,
                  boxShadow: `0 0 5px rgba(${ac}, .7)`,
                  animation: `cyber-spin-dots 1.4s ease-in-out infinite both`,
                  animationDelay: `${i * 0.16}s`,
                }}
              />
            ))}
          </div>
          <span className="text-[10px] font-bold tracking-wider" style={{ color: `rgba(${ac}, 0.9)` }}>
            {streamStatus === "thinking" && "PENSANDO..."}
            {streamStatus === "pesquisando" && "BUSCANDO..."}
            {streamStatus === "gerando_imagem" && "GERANDO IMAGEM..."}
          </span>
        </div>
      </div>

      <div className="max-w-[580px] mx-auto">
        <div
          className="rounded-2xl px-3 pt-2.5 pb-2 transition-all duration-200 relative"
          style={{
            background: "linear-gradient(135deg, #131f35 0%, rgba(79, 70, 229, 0.06) 100%)",
            border: `1.5px solid ${borderColor}`,
            boxShadow: focusShadow,
          }}
        >
          {/* File previews */}
          {showFiles && files.length > 0 && (
            <div className="mb-3 space-y-2 animate-in slide-in-from-top-2 fade-in duration-200">
              {files.map((file) => (
                <div
                  key={file.id}
                  className={cn(
                    "group flex items-center gap-2 p-2 rounded-lg border transition-colors",
                    file.uploading && !file.error
                      ? "bg-yellow-500/10 border-yellow-500/40"
                      : file.error
                      ? "bg-red-500/10 border-red-500/40"
                      : "border-[#334155] hover:border-indigo-500/30",
                  )}
                  style={{
                    background: file.uploading && !file.error
                      ? undefined
                      : file.error
                      ? undefined
                      : "rgba(30, 41, 59, 0.6)",
                  }}
                >
                  {file.previewUrl && file.file.type.includes("image") ? (
                    <div className="w-10 h-10 rounded bg-slate-800/50 overflow-hidden shrink-0">
                      <img
                        src={file.previewUrl}
                        alt={file.file.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : file.previewUrl && file.file.type.includes("video") ? (
                    <div className="w-10 h-10 rounded bg-slate-800/50 overflow-hidden shrink-0">
                      <video src={file.previewUrl} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 border border-indigo-500/10">
                      {getFileIcon(file.file.type)}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate text-slate-200" title={file.file.name}>
                      {file.file.name}
                    </p>
                    <div className="flex items-center gap-2 text-[9px] text-slate-500">
                      <span>{formatFileSize(file.file.size)}</span>
                      <span>{file.file.type.split("/")[1] || "arquivo"}</span>
                    </div>
                  </div>

                  {file.uploading && !file.error && (
                    <div className="w-4 h-4 border-2 border-yellow-500/50 border-t-yellow-500 rounded-full animate-spin" />
                  )}

                  {file.error && (
                    <div className="flex items-center gap-1 text-red-400 text-[9px]">
                      <span>FALHA</span>
                      <X size={10} />
                    </div>
                  )}

                  <button
                    onClick={() => removeFile(file.id)}
                    className="p-1 rounded-full bg-slate-700 hover:bg-red-500/80 text-slate-400 hover:text-white opacity-60 group-hover:opacity-100 transition-all"
                    title="Remover arquivo"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.json,.md,.ts,.tsx,.js,.jsx,.py"
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              if (picked.length > 0) {
                onSelectFiles?.(picked);
                onToggleFiles(true);
              }
              e.target.value = "";
            }}
          />

          {/* Row: attach + file status */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!showFiles || files.length === 0) {
                  fileInputRef.current?.click();
                } else {
                  onToggleFiles(!showFiles);
                }
              }}
              disabled={isStreaming}
              className={cn(
                "p-2 rounded-lg transition-all duration-150 shrink-0",
                showFiles
                  ? "text-indigo-400"
                  : "text-slate-500 hover:text-indigo-400",
                isStreaming && "opacity-40 cursor-not-allowed",
              )}
              style={showFiles ? { background: "rgba(99,102,241,0.12)" } : {}}
              title={showFiles ? "Esconder arquivos" : "Anexar arquivo (Shift+P)"}
            >
              <Paperclip size={15} />
            </button>

            {/* Microfone — voz → texto (aparece só se o STT estiver ativo no Onyx) */}
            <BotaoMicrofone
              accent={ac}
              disabled={isStreaming}
              onTranscrito={(texto) => { onChange(value ? `${value} ${texto}` : texto); onVozUsada?.(); }}
            />

            <div className="flex items-center gap-2">
              {showFiles && !isStreaming && (
                <button type="button" onClick={() => onFilesChange([])} title="Limpar todos">
                  <X size={12} className="text-slate-500 hover:text-slate-300 transition-colors" />
                </button>
              )}
              {files.length > 0 && !isStreaming && (
                <span className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wider",
                  filesReady
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : isAllUploadsFinished
                    ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                )}>
                  {files.filter(f => !f.uploading && !f.error).length}/{files.length} PRONTOS
                </span>
              )}
              <span className="text-[9px] text-slate-600 select-none hidden sm:block">
                {isStreaming
                  ? "ESC PARA PARAR"
                  : filesReady && files.length > 0
                  ? "ENTER PARA ENVIAR"
                  : files.length > 0
                  ? "AGUARDANDO UPLOADS..."
                  : "SHIFT+P PARA ANEXAR"
                }
              </span>
            </div>
          </div>

          {/* Textarea */}
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={isStreaming ? "..." : placeholder}
            disabled={disabled || isStreaming}
            className="w-full bg-transparent text-[13px] text-slate-100 placeholder:text-slate-600 resize-none outline-none leading-relaxed min-h-[36px] sm:min-h-[40px] max-h-[160px] overflow-y-auto mt-1.5"
            style={{ caretColor: isStreaming ? "#475569" : `rgba(${ac}, 1)` }}
            rows={1}
          />

          {/* Footer */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2 h-6">
              {/* Seletor de modelo de imagem — só aparece ao pedir uma imagem */}
              {showImageSelector && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={openImgMenu}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer hover:brightness-110"
                    style={{ background: "rgba(168,85,247,0.14)", border: "1px solid rgba(168,85,247,0.4)", color: "#d8b4fe" }}
                    title="Modelo de geração de imagem (configuração global)"
                  >
                    <Palette size={11} />
                    <span className="max-w-[110px] truncate">
                      {currentImgModel ? imageModelLabel(currentImgModel.image_provider_id, currentImgModel.model_name).label : "Modelo de imagem"}
                    </span>
                    <ChevronDown size={10} className={cn("transition-transform", imgOpen && "rotate-180")} />
                  </button>

                  {imgOpen && (
                    <div
                      className="absolute bottom-full left-0 mb-1.5 z-50 w-60 rounded-xl overflow-hidden"
                      style={{ background: "#0a1020", border: "1px solid rgba(168,85,247,0.3)", boxShadow: "0 12px 40px rgba(0,0,0,0.6)" }}
                    >
                      <div className="px-3 py-2 text-[9px] font-black uppercase tracking-widest" style={{ color: "#9a7bc0", borderBottom: "1px solid rgba(168,85,247,0.12)" }}>
                        Modelo de imagem
                      </div>
                      {imgModels === null ? (
                        <div className="px-3 py-3 text-[11px]" style={{ color: "#6b7fa0" }}>Carregando…</div>
                      ) : imgModels.length === 0 ? (
                        <div className="px-3 py-3 text-[11px]" style={{ color: "#6b7fa0" }}>Nenhum modelo configurado.</div>
                      ) : (
                        imgModels.map(m => {
                          const meta = imageModelLabel(m.image_provider_id, m.model_name);
                          return (
                            <button
                              key={m.image_provider_id}
                              type="button"
                              disabled={imgBusy}
                              onClick={() => pickImgModel(m.image_provider_id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors cursor-pointer hover:bg-white/5 disabled:opacity-50"
                            >
                              <div className="w-4 shrink-0">{m.is_default && <Check size={12} style={{ color: "#a855f7" }} />}</div>
                              <div className="min-w-0">
                                <p className="text-[11.5px] font-bold leading-tight" style={{ color: m.is_default ? "#e9d5ff" : "#cbd5e1" }}>{meta.label}</p>
                                <p className="text-[9.5px] leading-tight" style={{ color: "#6b7fa0" }}>{meta.hint}</p>
                              </div>
                            </button>
                          );
                        })
                      )}
                      <div className="px-3 py-1.5 text-[8.5px]" style={{ color: "#6b5a80", borderTop: "1px solid rgba(168,85,247,0.1)" }}>
                        Configuração global · afeta todos os agentes
                      </div>
                    </div>
                  )}
                </div>
              )}

              {model && !showImageSelector && (
                <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">
                  {model.split(":")[0].toUpperCase()}
                </span>
              )}
              {value.length > CHAR_COUNTER_THRESHOLD && (
                <span
                  className="text-[9px] font-mono"
                  style={{ color: value.length > 1500 ? "#f87171" : "#94a3b8" }}
                >
                  {value.length}
                </span>
              )}
              {files.length > 0 && (
                <span className={cn(
                  "text-[9px] font-medium px-1.5 py-0.5 rounded border",
                  files.every(f => !f.uploading && !f.error)
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                )}>
                  {files.every(f => !f.uploading && !f.error) ? "PRONTO P/ ENVIAR" : `${files.filter(f => !f.uploading && !f.error).length}/${files.length}`}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isStreaming ? (
                <button
                  onClick={onStop}
                  title="Parar (Esc)"
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:text-red-300 transition-colors"
                  style={{
                    background: "rgba(239,68,68,0.12)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    boxShadow: "0 0 8px rgba(239,68,68,0.2)",
                  }}
                >
                  <Square size={11} fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  title="Enviar (Enter)"
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 hover:scale-105"
                  style={{
                    background: canSend
                      ? `linear-gradient(135deg, rgba(${ac},1) 0%, rgba(${ac},0.75) 100%)`
                      : `rgba(${ac},0.08)`,
                    border: canSend
                      ? `1px solid rgba(${ac},0.5)`
                      : `1px solid rgba(${ac},0.15)`,
                    boxShadow: canSend
                      ? `0 0 12px rgba(${ac},0.35)`
                      : "none",
                    color: canSend ? "#fff" : "#475569",
                  }}
                >
                  <ArrowUp size={14} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-2 text-center">
          <p className="text-[10px] text-slate-700">
            {showFiles
              ? "Shift+P para ocultar • Rolar para ver arquivos"
              : "Enter para enviar • Shift+Enter para nova linha"
            }
          </p>
          {isStreaming && (
            <p className="text-[10px] text-slate-700 mt-1">Pressione ESC para cancelar</p>
          )}
        </div>
      </div>
    </div>
  );
}
