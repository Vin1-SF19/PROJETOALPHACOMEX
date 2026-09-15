"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import BibbleChatInput from "./BibbleChatInput";
import BibblePromptSuggestions from "./BibblePromptSuggestions";
import { type StreamStatus } from "./BibbleChatLayout";
import type { UploadedFile } from "./BibbleFileUpload";
import { type TemaAlpha } from "@/lib/temas";

interface BibbleEmptyStateProps {
  userName: string;
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
  onSelectFiles?: (files: File[]) => void;
  tema?: TemaAlpha;
  isAdmin?: boolean;
  imageGenAvailable?: boolean;
  onVozUsada?: () => void;
  activeAgentName?: string | null;
  activeAgentAvatarUrl?: string | null;
  permissions?: string[];
}

export default function BibbleEmptyState({
  userName,
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
  onSelectFiles,
  tema,
  isAdmin,
  imageGenAvailable,
  onVozUsada,
  activeAgentName,
  activeAgentAvatarUrl,
  permissions = [],
}: BibbleEmptyStateProps) {
  const [nameHovered, setNameHovered] = useState(false);
  const ac = tema?.accent ?? "99, 102, 241";

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden pb-4">

      {/* Glow central */}
      <div
        aria-hidden
        className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, rgba(${ac}, 0.11) 0%, rgba(${ac}, 0.04) 45%, transparent 70%)`,
        }}
      />

      {/* Glow inferior */}
      <div
        aria-hidden
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[180px] pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center bottom, rgba(${ac}, 0.07) 0%, transparent 70%)`,
        }}
      />

      {/* Cantos decorativos */}
      <div aria-hidden className="absolute top-0 left-0 w-28 h-28 pointer-events-none"
        style={{ borderBottom: `1px solid rgba(${ac}, 0.18)`, borderLeft: `1px solid rgba(${ac}, 0.18)`, borderRadius: "0 0 0 16px" }} />
      <div aria-hidden className="absolute top-0 right-0 w-28 h-28 pointer-events-none"
        style={{ borderTop: `1px solid rgba(${ac}, 0.18)`, borderRight: `1px solid rgba(${ac}, 0.18)`, borderRadius: "0 0 16px 0" }} />
      <div aria-hidden className="absolute bottom-0 right-0 w-28 h-28 pointer-events-none"
        style={{ borderRight: `1px solid rgba(${ac}, 0.18)`, borderBottom: `1px solid rgba(${ac}, 0.18)`, borderRadius: "16px 0 0 0" }} />
      <div aria-hidden className="absolute bottom-0 left-0 w-28 h-28 pointer-events-none"
        style={{ borderLeft: `1px solid rgba(${ac}, 0.18)`, borderBottom: `1px solid rgba(${ac}, 0.18)`, borderRadius: "0 16px 0 0" }} />

      {/* Partículas flutuantes */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        {([
          { x: 12, y: 22, d: 0 },
          { x: 88, y: 18, d: 0.8 },
          { x: 8,  y: 68, d: 1.4 },
          { x: 92, y: 62, d: 0.5 },
          { x: 48, y: 88, d: 1.1 },
          { x: 72, y: 40, d: 2.0 },
        ] as { x: number; y: number; d: number }[]).map((p, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{
              left: `${p.x}%`,
              top:  `${p.y}%`,
              background: `rgba(${ac}, 0.55)`,
              boxShadow: `0 0 6px rgba(${ac}, 0.6)`,
            }}
            animate={{ opacity: [0.25, 0.75, 0.25], scale: [1, 1.4, 1] }}
            transition={{ duration: 3.2 + i * 0.4, delay: p.d, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>

      {/* Conteúdo principal */}
      <div className="relative z-10 w-full max-w-[720px] px-5 flex flex-col items-center gap-4">

        {/* Logo */}
        <motion.div
          className="flex items-center justify-center gap-2"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 4px 20px rgba(${ac}, 0.4))` }}
        >
          <Image src={activeAgentAvatarUrl || "/Logo_Principal.png"} alt={activeAgentName || "Bibble"} width={activeAgentName ? 48 : 130} height={activeAgentName ? 48 : 42} className={activeAgentName ? "object-cover rounded-full" : "object-contain"} priority />
          {activeAgentName && <span className="text-lg font-bold text-white">{activeAgentName}</span>}
          <span
            className="text-[11px] font-black uppercase tracking-widest"
            style={{ color: `rgba(${ac}, 0.6)` }}
          >
          BETA
          </span>
        </motion.div>

        {/* Saudação */}
        <motion.div
          className="text-center space-y-1.5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
        >
          <h1
            className="font-extrabold tracking-tight select-none"
            style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)", lineHeight: 1.1 }}
          >
            <span style={{ color: "rgba(255,255,255,0.88)" }}>Olá,&nbsp;</span>

            {/* Nome com efeito espelho */}
            <span
              className="relative inline-block cursor-default"
              style={{ overflow: "hidden" }}
              onMouseEnter={() => setNameHovered(true)}
              onMouseLeave={() => setNameHovered(false)}
            >
              {/* Texto com gradiente */}
              <span
                style={{
                  background: `linear-gradient(135deg, rgba(${ac},1) 0%, rgba(255,255,255,0.92) 55%, rgba(${ac},0.85) 100%)`,
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  display: "inline-block",
                }}
              >
                {userName}
              </span>

              {/* Shimmer sweep — efeito espelho */}
              <AnimatePresence>
                {nameHovered && (
                  <motion.span
                    key="shimmer"
                    aria-hidden
                    className="absolute top-0 bottom-0 pointer-events-none"
                    style={{
                      width: "55%",
                      background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)",
                      filter: "blur(3px)",
                    }}
                    initial={{ left: "-55%" }}
                    animate={{ left: "120%" }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={{ duration: 2, ease: "easeInOut" }}
                  />
                )}
              </AnimatePresence>

              {/* Sublinhado com glow */}
              <motion.span
                aria-hidden
                className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full pointer-events-none"
                style={{ background: `linear-gradient(90deg, transparent, rgba(${ac}, 0.7), transparent)` }}
                animate={nameHovered
                  ? { scaleX: 1, opacity: 1 }
                  : { scaleX: 0.4, opacity: 0.3 }
                }
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </span>

            <span style={{ color: "rgba(255,255,255,0.6)" }}></span>
          </h1>

          <p
            className="text-base font-medium tracking-wide"
            style={{ color: "rgba(148, 163, 184, 0.9)" }}
          >
            {activeAgentName ? `Você está conversando com ${activeAgentName}.` : "O que vamos resolver hoje?"}
          </p>
        </motion.div>

        {/* Input */}
        <motion.div
          className="w-full"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.22, ease: "easeOut" }}
        >
          <BibbleChatInput
            value={inputValue}
            onChange={onInputChange}
            onSend={onSend}
            onStop={onStop}
            isStreaming={isStreaming}
            streamStatus={streamStatus}
            files={uploadFiles}
            onFilesChange={onFilesChange}
            showFiles={showFiles}
            onToggleFiles={onToggleFiles}
            onSelectFiles={onSelectFiles}
            onVozUsada={onVozUsada}
            tema={tema}
            isAdmin={isAdmin}
            imageGenAvailable={imageGenAvailable}
            placeholder={`Pergunte algo a ${activeAgentName || "Bibble"}...`}
          />
        </motion.div>

        {/* Sugestões */}
        <motion.div
          className="w-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.32 }}
        >
          <BibblePromptSuggestions onSelect={onSuggestion} activeAgentName={activeAgentName} permissions={permissions} isAdmin={isAdmin} />
        </motion.div>

      </div>
    </div>
  );
}
