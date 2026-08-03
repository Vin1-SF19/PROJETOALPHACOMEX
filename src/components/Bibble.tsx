"use client";

import Image from "next/image";
import { X, Send } from "lucide-react";
import { useBibble } from "@/context/BibbleContext";
import { usePathname } from "next/navigation";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import { notificarCalendarioAlphaAlterado } from "@/lib/google-calendar/invalidation";
import { getTema } from "@/lib/temas";
import { isAdminRole } from "@/lib/roles";

// ─── Types ───────────────────────────────────────────────────────────────────

type BibbleStatus =
  | "idle"
  | "idle_alt"
  | "thinking"
  | "pesquisando"
  | "serious"
  | "happy"
  | "aceno"
  | "sad"
  | "erro"
  | "walking"
  | "walkingHappy"
  | "walkingSad"
  | "walkingSerius";

interface ChatMessage {
  role: "user" | "bibble";
  text: string;
}

// ─── Sprites ─────────────────────────────────────────────────────────────────

const WALK_FRAMES = [
  "/assets/bibble/walking/walk-1.png",
  "/assets/bibble/walking/walk-2.png",
  "/assets/bibble/walking/walk-3.png",
  "/assets/bibble/walking/walk-4.png",
  "/assets/bibble/walking/walk-5.png",
  "/assets/bibble/walking/walk-6.png",
  "/assets/bibble/walking/walk-7.png",
  "/assets/bibble/walking/walk-8.png",
  "/assets/bibble/walking/walk-9.png",
];

const SPRITES: Record<BibbleStatus, string[]> = {
  idle:          ["/assets/bibble/bibble-idle2.png"],
  idle_alt:      ["/assets/bibble/bibble-idle.png"],
  thinking:      ["/assets/bibble/bibble-thinking.png"],
  pesquisando:   ["/assets/bibble/bibble-pesquisando.png"],
  serious:       ["/assets/bibble/bibble-serious.png"],
  happy:         ["/assets/bibble/bibble-excited.png"],
  aceno:         ["/assets/bibble/bibble-aceno.png"],
  sad:           ["/assets/bibble/bibble-sad.png"],
  erro:          ["/assets/bibble/bibble-erro.png"],
  // Todos os estados de caminhada usam os 9 frames de animação
  walking:       WALK_FRAMES,
  walkingHappy:  WALK_FRAMES,
  walkingSad:    WALK_FRAMES,
  walkingSerius: WALK_FRAMES,
};

// Falas autônomas por humor
const FALAS_IDLE = [
  "Alguém abre um chamado, pelo menos.",
  "O tédio me consome em ciclos de 16ms.",
  "Vini, vai ter reunião hoje ou posso relaxar?",
  "Sistema estável. Infelizmente.",
];
const FALAS_RETORNO_HAPPY = [
  "Voltei. Fui ali resolver uns bugs de cota do Google. De nada.",
  "Dei uma volta pra esticar as pernas virtuais. O que eu perdi?",
  "Estava ali verificando se o servidor ainda tava de pé. Tava.",
];
const FALAS_RETORNO_SAD = [
  "Voltei... Tentei falar com o suporte técnico. Eles me xingaram em binário.",
  "O mundo lá fora é assustador. Tem gente que não usa modo escuro.",
  "Fui ali e descobri que o código antigo foi escrito às 3h da manhã. Que depressão.",
];

const HUMOR_WALKING: BibbleStatus[] = ["walking", "walkingHappy", "walkingSad", "walkingSerius"];

function escolher<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPos() {
  if (typeof window === "undefined") return { x: 100, y: 100 };
  return {
    x: Math.random() * (window.innerWidth - 280) + 40,
    y: Math.random() * (window.innerHeight - 280) + 40,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────
// Nota: Bibble aparece apenas em páginas do PainelAlpha (/PainelAlpha/*)
// para evitar distrações no dashboard

export default function BibbleChat() {
  const { data: session } = useSession();
  const { contextoExtra } = useBibble();
  const pathname = usePathname();

  const isAdmin = isAdminRole(session?.user?.role);

  // ─── Guard: só aparece em páginas do PainelAlpha (outra área para o dashboard) ───
  const isPainelAlpha = pathname.startsWith("/PainelAlpha");
  if (!isPainelAlpha) return null;

  const temaNome = (session?.user as { tema_interface?: string })?.tema_interface;
  const visual = getTema(temaNome);
  const accent = visual.accent; // "r, g, b"

  // Chat state
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "bibble", text: "O que vamos resolver hoje?" },
  ]);
  const [loading, setLoading] = useState(false);

  // Avatar state
  const [status, setStatus] = useState<BibbleStatus>("aceno");
  const [frame, setFrame] = useState(0);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [speechBubble, setSpeechBubble] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [hidden, setHidden] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(false);
  const timerIds = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Helper: setTimeout that auto-cancels on unmount
  const safeTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timerIds.current = timerIds.current.filter((t) => t !== id);
      if (isMountedRef.current) fn();
    }, ms);
    timerIds.current.push(id);
    return id;
  }, []);

  // ── Mount / unmount guard ──
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      timerIds.current.forEach(clearTimeout);
      timerIds.current = [];
    };
  }, []);

  // ── Auto-scroll ──
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ── Frame animation (walking = 100ms/frame, others = 180ms) ──
  useEffect(() => {
    const frames = SPRITES[status];
    if (frames.length <= 1) { setFrame(0); return; }
    const isWalking = status.startsWith("walking");
    const id = setInterval(() => {
      if (isMountedRef.current) setFrame((p) => (p + 1) % frames.length);
    }, isWalking ? 100 : 180);
    return () => clearInterval(id);
  }, [status]);

  // ── Initialise position on mount (random) ──
  useEffect(() => {
    setPosition(randomPos());
    const t = safeTimeout(() => setStatus("idle"), 3000);
    return () => clearTimeout(t);
  }, [safeTimeout]);

  // ── Autonomous behaviour loop ──
  const agir = useCallback(() => {
    if (isOpen || hidden) return;

    const roll = Math.random();

    if (roll < 0.15) {
      // Esconde por 20-60s
      setHidden(true);
      const delay = Math.random() * 40000 + 20000;
      safeTimeout(() => {
        const humor = Math.random() > 0.5 ? "happy" : "sad";
        const fala = humor === "happy"
          ? escolher(FALAS_RETORNO_HAPPY)
          : escolher(FALAS_RETORNO_SAD);
        setHidden(false);
        setPosition(randomPos());
        setStatus(humor);
        setSpeechBubble(fala);
        safeTimeout(() => {
          setSpeechBubble(null);
          setStatus("idle");
          safeTimeout(agir, Math.random() * 12000 + 8000);
        }, 10000);
      }, delay);
      return;
    }

    if (roll < 0.45) {
      // Caminha para novo ponto
      const humor = escolher(HUMOR_WALKING);
      setStatus(humor);
      setPosition({
        x: Math.random() * (window.innerWidth - 300) + 50,
        y: Math.random() * (window.innerHeight - 300) + 50,
      });
      safeTimeout(() => setStatus("idle"), 3500);
    } else if (roll < 0.65) {
      // Fala algo
      setSpeechBubble(escolher(FALAS_IDLE));
      safeTimeout(() => setSpeechBubble(null), 7000);
    } else {
      setStatus("idle");
    }

    safeTimeout(agir, Math.random() * 15000 + 8000);
  }, [isOpen, hidden, safeTimeout]);

  useEffect(() => {
    const id = safeTimeout(agir, 5000);
    return () => clearTimeout(id);
  }, [agir, safeTimeout]);

  // ── Send message ──
  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setMessages((p) => [...p, { role: "user", text: userText }]);
    setInput("");
    setLoading(true);
    setStatus("thinking");

    try {
      const res = await fetch("/api/bibble/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          history: messages,
          context: { urlAtual: pathname, ...contextoExtra },
        }),
      });

      if (!res.ok || !res.body) {
        setMessages((p) => [...p, { role: "bibble", text: "Tive um soluço aqui. Tenta de novo." }]);
        setStatus("erro");
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(part.slice(6));

            if (ev.type === "status") {
              setStatus(ev.state as BibbleStatus);
            } else if (ev.type === "text") {
              setMessages((p) => [...p, { role: "bibble", text: ev.text }]);
              setStatus("happy");
              setTimeout(() => setStatus("idle"), 4000);
            } else if (ev.type === "calendar_changed") {
              notificarCalendarioAlphaAlterado();
            } else if (ev.type === "error") {
              setMessages((p) => [...p, { role: "bibble", text: ev.message }]);
              setStatus("erro");
              setTimeout(() => setStatus("idle"), 4000);
            }
          } catch {
            // malformed SSE line — skip
          }
        }
      }
    } catch {
      setMessages((p) => [...p, { role: "bibble", text: "Erro de rede. Tenta de novo." }]);
      setStatus("erro");
    } finally {
      setLoading(false);
    }
  };


  const currentSprite = (SPRITES[status] ?? SPRITES.idle)[frame] ?? SPRITES.idle[0];

  return (
    <div className="fixed inset-0 pointer-events-none z-[200] font-sans select-none">
      <AnimatePresence>
        {/* ── Chat window ── */}
        {isOpen ? (
          <motion.div
            key="chat"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute bottom-10 right-10 pointer-events-auto"
          >
            <div
              className="w-[360px] h-[560px] bg-slate-900 rounded-[2rem] shadow-2xl flex flex-col overflow-hidden"
              style={{ border: `1px solid rgba(${accent},0.25)` }}
            >
              {/* Header */}
              <div
                className="p-4 flex items-center justify-between backdrop-blur-md"
                style={{ background: `rgba(${accent},0.08)`, borderBottom: `1px solid rgba(${accent},0.15)` }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden p-0.5"
                    style={{ background: `linear-gradient(135deg, rgba(${accent},0.8), rgba(${accent},0.3))` }}
                  >
                    <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center overflow-hidden">
                      <Image
                        src={currentSprite}
                        alt="Bibble"
                        width={44}
                        height={44}
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-black italic uppercase text-xs tracking-widest text-white">
                      Bibble
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${loading ? "animate-pulse" : ""}`}
                        style={{ background: loading ? `rgb(${accent})` : "#10b981" }}
                      />
                      <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-tight">
                        {loading ? "Processando..." : "Online"}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-all cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Messages */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4"
                style={{ scrollbarWidth: "thin" }}
              >
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap ${
                        m.role === "user"
                          ? "text-white rounded-tr-none font-medium"
                          : "bg-slate-800 text-slate-100 border border-white/10 rounded-tl-none"
                      }`}
                      style={
                        m.role === "user"
                          ? { background: `rgba(${accent},0.85)` }
                          : undefined
                      }
                    >
                      {m.text}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex items-center gap-2">
                    <div className="bg-slate-800 px-4 py-3 rounded-2xl rounded-tl-none border border-white/5">
                      <div className="flex gap-1.5">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="w-2 h-2 rounded-full animate-bounce"
                            style={{
                              background: `rgba(${accent},0.8)`,
                              animationDelay: `${i * 0.15}s`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="p-4 bg-slate-900 border-t border-white/10">
                <div
                  className="flex gap-2 bg-white/5 p-1.5 rounded-2xl transition-all"
                  style={{ border: `1px solid rgba(${accent},0.15)` }}
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                    placeholder="Pergunte algo..."
                    className="flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500"
                    disabled={loading}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={loading || !input.trim()}
                    className="p-2.5 rounded-xl text-white transition-all active:scale-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    style={{ background: `rgba(${accent},0.85)` }}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          /* ── Floating avatar ── */
          !hidden && position && (
            <motion.div
              key="avatar"
              initial={{ x: position.x, y: position.y, opacity: 0 }}
              animate={{ x: position.x, y: position.y, opacity: 1 }}
              transition={{
                x: { duration: 3.5, ease: "easeInOut" },
                y: { duration: 3.5, ease: "easeInOut" },
                opacity: { duration: 0.4 },
              }}
              className="absolute pointer-events-auto flex flex-col items-center"
            >
              {/* Speech bubble */}
              <AnimatePresence>
                {(isHovered || speechBubble) && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.85 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-[calc(100%+8px)] bg-white text-slate-900 px-5 py-3 rounded-[1.5rem] font-semibold text-sm shadow-xl whitespace-nowrap z-[210]"
                    style={{ border: `2px solid rgba(${accent},0.8)` }}
                  >
                    {speechBubble ?? "Clica logo, não tenho o dia todo."}
                    <div
                      className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-0 h-0"
                      style={{
                        borderLeft: "10px solid transparent",
                        borderRight: "10px solid transparent",
                        borderTop: `12px solid rgba(${accent},0.8)`,
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={() => setIsOpen(true)}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="cursor-pointer w-[180px] h-[180px] flex items-center justify-center outline-none transition-transform hover:scale-110 active:scale-95"
              >
                <Image
                  src={currentSprite}
                  alt="Bibble"
                  width={180}
                  height={180}
                  className="object-contain drop-shadow-2xl"
                  unoptimized
                  priority
                />
              </button>
            </motion.div>
          )
        )}
      </AnimatePresence>
    </div>
  );
}
