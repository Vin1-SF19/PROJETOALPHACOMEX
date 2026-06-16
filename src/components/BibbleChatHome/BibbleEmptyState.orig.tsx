"use client";

import BibbleChatInput from "./BibbleChatInput";
import BibblePromptSuggestions from "./BibblePromptSuggestions";
import { type StreamStatus } from "./BibbleChatLayout";
import type { UploadedFile } from "./BibbleFileUpload";

interface BibbleEmptyStateProps {
  userName: string;
  model: string;
  inputValue: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  streamStatus: StreamStatus;
  onSuggestion: (prompt: string) => void;
  uploadFiles: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  showFiles: boolean;
  onToggleFiles: (show: boolean) => void;
}

export default function BibbleEmptyState({
  userName,
  model,
  inputValue,
  onInputChange,
  onSend,
  onStop,
  isStreaming,
  streamStatus,
  onSuggestion,
  uploadFiles,
  onFilesChange,
  showFiles,
  onToggleFiles,
}: BibbleEmptyStateProps) {
  const firstName = userName.split(" ")[0];

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden pb-10">

      {/* Ambient glow */}
      <div
        aria-hidden
        className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-[60%] w-[700px] h-[300px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, rgba(59,130,246,0.07) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 w-full max-w-[720px] px-5 flex flex-col items-center gap-8">

        <div className="text-center space-y-2">
          <h1
            className="text-[32px] sm:text-[38px] font-black tracking-tight leading-none"
            style={{
              background: "linear-gradient(160deg, #ffffff 30%, #64748b 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Olá, {firstName}
          </h1>
          <p className="text-muted-foreground text-[15px] font-medium">
            No que posso ajudar?
          </p>
        </div>

        <div className="w-full">
          <BibbleChatInput
            value={inputValue}
            onChange={onInputChange}
            onSend={onSend}
            onStop={onStop}
            isStreaming={isStreaming}
            streamStatus={streamStatus}
            model={model}
            files={uploadFiles}
            onFilesChange={onFilesChange}
            showFiles={showFiles}
            onToggleFiles={onToggleFiles}
          />
        </div>

        <BibblePromptSuggestions onSelect={onSuggestion} />
      </div>
    </div>
  );
}
