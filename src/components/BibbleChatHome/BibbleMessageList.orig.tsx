"use client";

import { useEffect, useRef, useState } from "react";
import BibbleMessageBubble, { type Message } from "./BibbleMessageBubble";
import BibbleScrollToBottom from "./BibbleScrollToBottom";

export default function BibbleMessageList({
  messages,
  userName,
}: {
  messages: Message[];
  userName: string;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollBtn(distFromBottom > 200);
    };
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, []);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-6 relative">
      {messages.map(msg => (
        <BibbleMessageBubble key={msg.id} message={msg} userName={userName} />
      ))}
      <div ref={bottomRef} />
      {showScrollBtn && <BibbleScrollToBottom onClick={() => scrollToBottom()} />}
    </div>
  );
}
