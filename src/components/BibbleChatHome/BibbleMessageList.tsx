"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import BibbleMessageBubble, { type Message } from "./BibbleMessageBubble";
import BibbleScrollToBottom from "./BibbleScrollToBottom";

interface BibbleMessageListProps {
  messages: Message[];
  userName: string;
  agentActive?: boolean;
  agentAvatarUrl?: string | null;
  agentName?: string | null;
  /** Edita uma mensagem do usuário e reenvia a conversa a partir dela. */
  onEditMessage?: (messageId: string, novoTexto: string) => void;
  /** true enquanto há streaming — desabilita edição. */
  isStreaming?: boolean;
}

const BOTTOM_THRESHOLD = 120;

export default function BibbleMessageList({
  messages, userName, agentActive, agentAvatarUrl, agentName, onEditMessage, isStreaming,
}: BibbleMessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [showScroll, setShowScroll] = useState(false);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = containerRef.current;
    if (!el) return;
    if (smooth) {
      sentinelRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      el.scrollTop = el.scrollHeight;
    }
    atBottomRef.current = true;
    setShowScroll(false);
  }, []);

  useEffect(() => {
    if (!atBottomRef.current) return;
    const isStreaming = messages.some(m => m.streaming);
    // instant during streaming (called many times/sec), smooth for new messages
    scrollToBottom(!isStreaming);
  }, [messages, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distFromBottom <= BOTTOM_THRESHOLD;
    atBottomRef.current = atBottom;
    setShowScroll(!atBottom);
  }, []);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 min-h-0 overflow-y-auto"
    >
      <div className="mx-5 pb-6 pt-3">
        <div className="space-y-4">
          {messages.map((msg) => (
            <BibbleMessageBubble
              key={msg.id}
              message={msg}
              userName={userName}
              agentActive={agentActive}
              agentAvatarUrl={agentAvatarUrl}
              agentName={agentName}
              onEdit={onEditMessage}
              isStreaming={isStreaming}
            />
          ))}
          <div ref={sentinelRef} style={{ height: 1 }} />
        </div>
      </div>

      {showScroll && (
        <BibbleScrollToBottom onClick={() => scrollToBottom(true)} />
      )}
    </div>
  );
}
