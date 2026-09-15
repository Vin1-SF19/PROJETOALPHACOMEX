"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";
import { type StreamStatus } from "./BibbleChatLayout";
import { cn } from "@/lib/utils";
import type { UploadedFile } from "./BibbleFileUpload";
import { type TemaAlpha } from "@/lib/temas";
import { BotaoMicrofone } from "./BotaoMicrofone";

interface BibbleChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  streamStatus?: StreamStatus;
  disabled?: boolean;
  placeholder?: string;
  files?: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  showFiles: boolean;
  onToggleFiles: (show: boolean) => void;
  onSelectFiles?: (files: File[]) => void;
  tema?: TemaAlpha;
  isAdmin?: boolean;
  imageGenAvailable?: boolean;
  onVozUsada?: () => void;
}

const CHAR_COUNTER_THRESHOLD = 800;

export default function BibbleChatInput({
  value, onChange, onSend, onStop, isStreaming, streamStatus = "idle",
  disabled, placeholder = "Pergunte algo ao Bibble...", tema, onVozUsada,
}: BibbleChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const canSend = Boolean(value.trim()) && !isStreaming && !disabled;
  const ac = tema?.accent ?? "99, 102, 241";

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  const handleSend = useCallback(() => { if (canSend) onSend(); }, [canSend, onSend]);

  return (
    <div className="px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
      <div className={cn("max-w-[580px] mx-auto mb-2 flex justify-center", streamStatus === "idle" && "opacity-0 pointer-events-none")}>
        <span className="text-[10px] font-bold tracking-wider" style={{ color: `rgba(${ac}, 0.9)` }}>
          {streamStatus === "thinking" && "PENSANDO..."}
          {streamStatus === "pesquisando" && "BUSCANDO..."}
          {streamStatus === "gerando_imagem" && "GERANDO IMAGEM..."}
        </span>
      </div>
      <div className="max-w-[580px] mx-auto">
        <div className="rounded-2xl px-3 pt-2.5 pb-2" style={{ background: "#131f35", border: `1.5px solid rgba(${ac}, ${focused ? .7 : .2})` }}>
          <div className="flex items-center gap-2">
            <BotaoMicrofone accent={ac} disabled={isStreaming} onTranscrito={(texto) => { onChange(value ? `${value} ${texto}` : texto); onVozUsada?.(); }} />
            <span className="text-[9px] text-slate-600 select-none">CAPACIDADES DEFINIDAS PELO SERVIDOR</span>
          </div>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder={isStreaming ? "..." : placeholder}
            disabled={disabled || isStreaming}
            className="w-full bg-transparent text-[13px] text-slate-100 placeholder:text-slate-600 resize-none outline-none leading-relaxed min-h-[40px] max-h-[264px] overflow-y-auto mt-1.5"
            rows={1}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[9px] font-mono text-slate-500">{value.length > CHAR_COUNTER_THRESHOLD ? value.length : ""}</span>
            {isStreaming ? (
              <button onClick={onStop} title="Parar (Esc)" aria-label="Parar resposta" className="w-7 h-7 rounded-lg grid place-items-center text-red-400"><Square size={11} fill="currentColor" /></button>
            ) : (
              <button onClick={handleSend} disabled={!canSend} title="Enviar (Enter)" aria-label="Enviar mensagem" className="w-7 h-7 rounded-lg grid place-items-center disabled:opacity-40" style={{ background: `rgba(${ac}, .8)`, color: "white" }}><ArrowUp size={14} /></button>
            )}
          </div>
        </div>
        <p className="mt-2 text-center text-[10px] text-slate-700">Enter para enviar • Shift+Enter para nova linha</p>
      </div>
    </div>
  );
}
