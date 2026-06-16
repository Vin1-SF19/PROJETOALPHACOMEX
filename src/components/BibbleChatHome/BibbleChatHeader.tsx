"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { Bot, X } from "lucide-react";

interface BibbleChatHeaderProps {
  title: string;
  model: string;
  onRename: (title: string) => void;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  activeAgentName?: string | null;
  activeAgentAvatarUrl?: string | null;
  onClearAgent?: () => void;
}

export default function BibbleChatHeader({
  title,
  model,
  onRename,
  sidebarOpen,
  onToggleSidebar,
  activeAgentName,
  activeAgentAvatarUrl,
  onClearAgent,
}: BibbleChatHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);

  const handleSave = useCallback(() => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== title) onRename(trimmed);
    else setEditTitle(title);
    setIsEditing(false);
  }, [editTitle, title, onRename]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    else if (e.key === "Escape") {
      setEditTitle(title);
      setIsEditing(false);
    }
  };

  return (
    <div
      className="h-14 px-5 flex items-center gap-3 border-b"
      style={{
        background: "var(--bibble-bg-800, #0b1120)",
        borderColor: "var(--bibble-border, #1e2740)",
      }}
    >
      {/* Title — double-click to rename */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            type="text"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            autoFocus
            className="w-full bg-[#111111] text-sm font-bold text-[#f4f6fb] px-3 py-1.5 rounded-lg outline-none transition-shadow duration-200"
            style={{
              border: "1px solid rgba(99,102,241,0.5)",
              boxShadow: "0 0 0 1px rgba(99,102,241,0.3), 0 0 12px rgba(99,102,241,0.15)",
            }}
          />
        ) : (
          <h2
            className="text-sm font-bold text-[#f4f6fb] truncate cursor-default select-none hover:text-white transition-colors duration-150"
            title="Duplo-clique para renomear"
            onDoubleClick={() => {
              setEditTitle(title);
              setIsEditing(true);
            }}
          >
            {title}
          </h2>
        )}
      </div>

      {/* Chip do agente Onyx ativo */}
      {activeAgentName && !isEditing && (
        <div
          className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-md shrink-0"
          style={{ background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)" }}
        >
          <div className="w-5 h-5 rounded grid place-items-center overflow-hidden shrink-0 relative" style={{ background: "rgba(99,102,241,0.25)" }}>
            {activeAgentAvatarUrl ? (
              <Image src={activeAgentAvatarUrl} alt={activeAgentName} fill unoptimized className="object-cover" />
            ) : (
              <Bot size={11} style={{ color: "#a5b4fc" }} />
            )}
          </div>
          <span className="text-[11px] font-bold truncate max-w-[120px]" style={{ color: "#c7d2fe" }}>{activeAgentName}</span>
          {onClearAgent && (
            <button onClick={onClearAgent} className="opacity-70 hover:opacity-100 transition-opacity" title="Voltar ao Bibble padrão" style={{ color: "#a5b4fc" }}>
              <X size={11} strokeWidth={2.5} />
            </button>
          )}
        </div>
      )}

      {/* Model badge */}
      {model && !isEditing && !activeAgentName && (
        <span
          className="text-xs font-semibold tracking-wide px-2 py-0.5 rounded-md shrink-0 transition-opacity duration-200"
          style={{
            background: "rgba(74,98,246,.12)",
            border: "1px solid rgba(74,98,246,.3)",
            color: "#a5b4fc",
          }}
        >
          {model.split(":")[0].toUpperCase()}
        </span>
      )}

      {/* Sidebar toggle button */}
      {onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          className="h-8 w-8 grid place-items-center rounded-lg shrink-0 transition-all duration-150 hover:scale-105"
          title={sidebarOpen ? "Recolher painel" : "Abrir painel"}
          style={{
            color: "#4f6272",
            background: "transparent",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            {sidebarOpen
              ? <path d="M9 18l6-6-6-6"/>
              : <path d="M15 18l-6-6 6-6"/>
            }
          </svg>
        </button>
      )}
    </div>
  );
}
