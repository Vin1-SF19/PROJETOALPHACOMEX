"use client";

import { useCallback } from "react";
import { motion } from "framer-motion";
import BibbleChatHeader from "./BibbleChatHeader";
import BibbleMessageList from "./BibbleMessageList";
import BibbleChatInput from "./BibbleChatInput";
import BibbleEmptyState from "./BibbleEmptyState";
import BibbleSpriteCompanion from "./BibbleSpriteCompanion";
import { IAlphaCosmicBackground } from "./IAlphaCosmicBackground";
import { type Message } from "./BibbleMessageBubble";
import { type StreamStatus } from "./BibbleChatLayout";
import type { UploadedFile } from "./BibbleFileUpload";
import Image from "next/image";
import { type TemaAlpha } from "@/lib/temas";

// Accent fixo para os decorativos do chat (sem tema dinâmico aqui)
const CHAT_ACCENT = "99, 102, 241";

// Mesmas 6 posições do EmptyState
const CHAT_PARTICLES: { x: number; y: number; d: number }[] = [
  { x: 12, y: 22, d: 0 },
  { x: 88, y: 18, d: 0.8 },
  { x: 8, y: 68, d: 1.4 },
  { x: 92, y: 62, d: 0.5 },
  { x: 48, y: 88, d: 1.1 },
  { x: 72, y: 40, d: 2.0 },
];

interface BibbleChatWindowProps {
  sessionId: string | null;
  sessionTitle: string;
  messages: Message[];
  userName: string;
  userImage?: string | null;
  model: string;
  streamStatus: StreamStatus;
  inputValue: string;
  isStreaming: boolean;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  onEditMessage?: (messageId: string, novoTexto: string) => void;
  onRenameSession: (title: string) => void;
  activeAgentName?: string | null;
  activeAgentAvatarUrl?: string | null;
  hasActiveAgent?: boolean;
  onClearAgent?: () => void;
  isAdmin?: boolean;
  imageGenAvailable?: boolean;
  onVozUsada?: () => void;
  uploadFiles: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  showFiles: boolean;
  onToggleFiles: (show: boolean) => void;
  onSelectFiles?: (files: File[]) => void;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  tema?: TemaAlpha;
  currentHour: number;
}

export default function BibbleChatWindow({
  sessionId,
  sessionTitle,
  messages,
  userName,
  userImage,
  model,
  streamStatus,
  inputValue,
  isStreaming,
  onInputChange,
  onSend,
  onStop,
  onEditMessage,
  onRenameSession,
  activeAgentName,
  activeAgentAvatarUrl,
  hasActiveAgent,
  onClearAgent,
  isAdmin,
  imageGenAvailable,
  onVozUsada,
  uploadFiles,
  onFilesChange,
  showFiles,
  onToggleFiles,
  onSelectFiles,
  sidebarOpen,
  onToggleSidebar,
  tema,
  currentHour,
}: BibbleChatWindowProps) {
  const hasMessages = messages.length > 0;
  const ac = tema?.accent ?? "99, 102, 241";

  const handleSuggestion = useCallback((prompt: string) => {
    onInputChange(prompt);
  }, [onInputChange]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#020617] min-w-0 relative overflow-hidden">
      <IAlphaCosmicBackground accent={ac} currentHour={currentHour} />

      {/* Decorativos de fundo — só quando há mensagens */}
      {hasMessages && (
        <>
          {/* Cantos decorativos */}
          <div aria-hidden className="absolute top-0 left-0 w-28 h-28 pointer-events-none z-0"
            style={{ borderBottom: `1px solid rgba(${CHAT_ACCENT}, 0.18)`, borderLeft: `1px solid rgba(${CHAT_ACCENT}, 0.18)`, borderRadius: "0 0 0 16px" }} />
          <div aria-hidden className="absolute top-0 right-0 w-28 h-28 pointer-events-none z-0"
            style={{ borderTop: `1px solid rgba(${CHAT_ACCENT}, 0.18)`, borderRight: `1px solid rgba(${CHAT_ACCENT}, 0.18)`, borderRadius: "0 0 16px 0" }} />
          <div aria-hidden className="absolute bottom-0 right-0 w-28 h-28 pointer-events-none z-0"
            style={{ borderRight: `1px solid rgba(${CHAT_ACCENT}, 0.18)`, borderBottom: `1px solid rgba(${CHAT_ACCENT}, 0.18)`, borderRadius: "16px 0 0 0" }} />
          <div aria-hidden className="absolute bottom-0 left-0 w-28 h-28 pointer-events-none z-0"
            style={{ borderLeft: `1px solid rgba(${CHAT_ACCENT}, 0.18)`, borderBottom: `1px solid rgba(${CHAT_ACCENT}, 0.18)`, borderRadius: "0 16px 0 0" }} />

          {/* Partículas flutuantes */}
          <div aria-hidden className="absolute inset-0 pointer-events-none z-0">
            {CHAT_PARTICLES.map((p, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  background: `rgba(${CHAT_ACCENT}, 0.55)`,
                  boxShadow: `0 0 6px rgba(${CHAT_ACCENT}, 0.6)`,
                }}
                animate={{ opacity: [0.25, 0.75, 0.25], scale: [1, 1.4, 1] }}
                transition={{ duration: 3.2 + i * 0.4, delay: p.d, repeat: Infinity, ease: "easeInOut" }}
              />
            ))}
          </div>
        </>
      )}

      {/* Header (when conversation is active) */}
      {hasMessages && sessionId ? (
        <div className="relative z-10">
          <BibbleChatHeader
            title={sessionTitle}
            model={model}
            onRename={onRenameSession}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={onToggleSidebar}
            activeAgentName={activeAgentName}
            activeAgentAvatarUrl={activeAgentAvatarUrl}
            onClearAgent={onClearAgent}
            tema={tema}
          />
        </div>
      ) : (
        /* Sidebar toggle button for empty state — fixed top-right, doesn't block content */
        onToggleSidebar && (
          <div className="absolute top-3 right-3 z-20">
            <button
              onClick={onToggleSidebar}
              className="h-8 w-8 grid place-items-center rounded-lg transition-all duration-200 hover:scale-105"
              title={sidebarOpen ? "Recolher painel" : "Abrir painel"}
              style={{
                background: sidebarOpen ? "transparent" : `rgba(${ac},0.15)`,
                border: sidebarOpen ? "none" : `1px solid rgba(${ac},0.3)`,
                color: sidebarOpen ? "#4f6272" : `rgba(${ac},1)`,
                boxShadow: sidebarOpen ? "none" : `0 2px 12px rgba(${ac},0.12)`,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                {sidebarOpen
                  ? <path d="M9 18l6-6-6-6"/>
                  : <path d="M15 18l-6-6 6-6"/>
                }
              </svg>
            </button>
          </div>
        )
      )}

      {/* Main Content */}
      {hasMessages ? (
        <div className="relative z-10 flex flex-col flex-1 min-h-0">
          <BibbleMessageList
            messages={messages}
            userName={userName}
            userImage={userImage}
            agentActive={hasActiveAgent}
            agentAvatarUrl={activeAgentAvatarUrl}
            agentName={activeAgentName}
            onEditMessage={onEditMessage}
            isStreaming={isStreaming}
            accent={ac}
          />

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
            onSelectFiles={onSelectFiles}
            onVozUsada={onVozUsada}
            tema={tema}
            isAdmin={isAdmin}
            imageGenAvailable={imageGenAvailable}
          />

          {/* Sprite — absolute, alinhado com a borda inferior do input */}
          <div className="absolute bottom-3 left-0 right-0 hidden lg:block pointer-events-none" style={{ zIndex: 20 }}>
            <BibbleSpriteCompanion isStreaming={isStreaming} />
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex-1 flex">
          <BibbleEmptyState
            userName={userName}
            model={model}
            inputValue={inputValue}
            onInputChange={onInputChange}
            onSend={onSend}
            onStop={onStop}
            isStreaming={isStreaming}
            streamStatus={streamStatus}
            onSuggestion={handleSuggestion}
            uploadFiles={uploadFiles}
            onFilesChange={onFilesChange}
            showFiles={showFiles}
            onToggleFiles={onToggleFiles}
            onSelectFiles={onSelectFiles}
            onVozUsada={onVozUsada}
            tema={tema}
            isAdmin={isAdmin}
            imageGenAvailable={imageGenAvailable}
          />
        </div>
      )}

      {/* Rodapé da empresa — oculto em mobile */}
      <div className="shrink-0 w-full hidden sm:flex items-center justify-center py-2 -mt-1">
        <Image
          src="/Rodapé.png"
          alt="Rodapé"
          width={200}
          height={20}
          className="object-contain opacity-40 hover:opacity-70 transition-opacity duration-300"
          style={{ marginBottom: 2 }}
        />
      </div>
    </div>
  );
}
