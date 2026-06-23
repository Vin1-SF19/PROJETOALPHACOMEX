"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState, useRef, useEffect } from "react";
import {
  ChevronDown, ChevronUp, FileText, Image as ImageIcon,
  Video, File, Copy, Check, Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  role: "user" | "assistant";
  /** Texto exibido na bolha (label curto quando há arquivos). */
  content: string;
  /**
   * Conteúdo completo enviado à IA e persistido no histórico — inclui o texto
   * extraído de PDFs/documentos. Quando ausente, usa-se `content`.
   */
  fullContent?: string;
  thinkContent?: string;
  files?: Array<{ name: string; type: string }>;
  streaming?: boolean;
  createdAt?: Date;
}

// ── Language color map ────────────────────────────────────────────────────────

interface LangMeta { bg: string; text: string; label: string }

const LANG_META: Record<string, LangMeta> = {
  html:       { bg: "rgba(239,68,68,0.18)",    text: "#f87171", label: "HTML"       },
  css:        { bg: "rgba(59,130,246,0.18)",   text: "#60a5fa", label: "CSS"        },
  javascript: { bg: "rgba(234,179,8,0.18)",    text: "#fbbf24", label: "JavaScript" },
  js:         { bg: "rgba(234,179,8,0.18)",    text: "#fbbf24", label: "JavaScript" },
  jsx:        { bg: "rgba(6,182,212,0.18)",    text: "#67e8f9", label: "JSX"        },
  typescript: { bg: "rgba(59,130,246,0.22)",   text: "#93c5fd", label: "TypeScript" },
  ts:         { bg: "rgba(59,130,246,0.22)",   text: "#93c5fd", label: "TypeScript" },
  tsx:        { bg: "rgba(59,130,246,0.22)",   text: "#93c5fd", label: "TSX"        },
  python:     { bg: "rgba(34,197,94,0.18)",    text: "#4ade80", label: "Python"     },
  py:         { bg: "rgba(34,197,94,0.18)",    text: "#4ade80", label: "Python"     },
  java:       { bg: "rgba(249,115,22,0.18)",   text: "#fb923c", label: "Java"       },
  cpp:        { bg: "rgba(139,92,246,0.18)",   text: "#c4b5fd", label: "C++"        },
  c:          { bg: "rgba(99,102,241,0.18)",   text: "#a5b4fc", label: "C"          },
  csharp:     { bg: "rgba(99,102,241,0.20)",   text: "#a5b4fc", label: "C#"         },
  php:        { bg: "rgba(139,92,246,0.22)",   text: "#c084fc", label: "PHP"        },
  sql:        { bg: "rgba(20,184,166,0.18)",   text: "#2dd4bf", label: "SQL"        },
  bash:       { bg: "rgba(15,23,42,0.85)",     text: "#94a3b8", label: "Bash"       },
  shell:      { bg: "rgba(15,23,42,0.85)",     text: "#94a3b8", label: "Shell"      },
  sh:         { bg: "rgba(15,23,42,0.85)",     text: "#94a3b8", label: "Shell"      },
  json:       { bg: "rgba(234,179,8,0.14)",    text: "#fcd34d", label: "JSON"       },
  xml:        { bg: "rgba(239,68,68,0.14)",    text: "#fca5a5", label: "XML"        },
  yaml:       { bg: "rgba(20,184,166,0.14)",   text: "#5eead4", label: "YAML"       },
  yml:        { bg: "rgba(20,184,166,0.14)",   text: "#5eead4", label: "YAML"       },
  markdown:   { bg: "rgba(99,102,241,0.14)",   text: "#818cf8", label: "Markdown"   },
  md:         { bg: "rgba(99,102,241,0.14)",   text: "#818cf8", label: "Markdown"   },
  rust:       { bg: "rgba(249,115,22,0.18)",   text: "#fdba74", label: "Rust"       },
  go:         { bg: "rgba(6,182,212,0.18)",    text: "#22d3ee", label: "Go"         },
  swift:      { bg: "rgba(249,115,22,0.20)",   text: "#fb923c", label: "Swift"      },
  kotlin:     { bg: "rgba(139,92,246,0.20)",   text: "#c4b5fd", label: "Kotlin"     },
};

function getLangMeta(lang?: string): LangMeta {
  if (!lang) return { bg: "rgba(30,45,74,0.6)", text: "#64748b", label: "código" };
  return LANG_META[lang.toLowerCase()] ?? { bg: "rgba(30,45,74,0.6)", text: "#94a3b8", label: lang.toUpperCase() };
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text, label = "COPIAR" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition-all duration-150"
      style={{ color: copied ? "#6ee7b7" : "#64748b" }}
      title="Copiar"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? "COPIADO" : label}
    </button>
  );
}

// ── Code block ────────────────────────────────────────────────────────────────

const CODE_COLLAPSE_THRESHOLD = 15;

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const lines     = code.split("\n").length;
  const [collapsed, setCollapsed] = useState(lines > CODE_COLLAPSE_THRESHOLD);
  const meta      = getLangMeta(language);

  return (
    <div
      className="my-3 rounded-xl overflow-hidden"
      style={{
        background: "#0a0f1e",
        border: "1px solid rgba(99,102,241,0.18)",
        boxShadow: "0 2px 16px rgba(0,0,0,0.4)",
      }}
    >
      {/* Header com badge de linguagem */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{
          background: "rgba(15,23,42,0.9)",
          borderBottom: "1px solid rgba(99,102,241,0.12)",
        }}
      >
        {/* Badge de linguagem */}
        <span
          className="px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase tracking-widest"
          style={{ background: meta.bg, color: meta.text }}
        >
          {meta.label}
        </span>

        <div className="flex items-center gap-3">
          {lines > CODE_COLLAPSE_THRESHOLD && (
            <button
              onClick={() => setCollapsed(p => !p)}
              className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition-colors"
              style={{ color: "#475569" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#94a3b8")}
              onMouseLeave={e => (e.currentTarget.style.color = "#475569")}
            >
              {collapsed
                ? <><ChevronDown size={11} /> Ver {lines} linhas</>
                : <><ChevronUp size={11} /> Recolher</>
              }
            </button>
          )}
          <CopyButton text={code} />
        </div>
      </div>

      {!collapsed && (
        <pre
          className="p-4 text-[12.5px] overflow-x-auto leading-relaxed font-mono"
          style={{ color: "#7dd3fc", margin: 0 }}
        >
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

// ── Thinking block ────────────────────────────────────────────────────────────

const THINK_COLLAPSED_CHAR_LIMIT = 500;

function ThinkingBlock({ content, streaming }: { content: string; streaming?: boolean }) {
  const [open, setOpen] = useState(!!streaming);
  const wasStreamingRef = useRef(!!streaming);

  useEffect(() => {
    if (wasStreamingRef.current && !streaming) setOpen(false);
    wasStreamingRef.current = !!streaming;
  }, [streaming]);

  const trimmed = content.trim();
  if (!trimmed) return null;

  const displayText =
    !open && trimmed.length > THINK_COLLAPSED_CHAR_LIMIT
      ? trimmed.slice(0, THINK_COLLAPSED_CHAR_LIMIT) + "…"
      : trimmed;

  return (
    <div
      className="mb-3 rounded-xl overflow-hidden"
      style={{ border: "1px solid rgba(99,102,241,0.15)", background: "rgba(15,23,42,0.5)" }}
    >
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 w-full px-3 py-2 transition-colors"
        style={{ color: "#818cf8" }}
      >
        <Lightbulb size={12} />
        <span className="text-[10px] font-bold uppercase tracking-widest">Raciocínio</span>
        {open ? <ChevronUp size={12} className="ml-auto opacity-60" /> : <ChevronDown size={12} className="ml-auto opacity-60" />}
      </button>
      {open && (
        <div
          className="px-3 pb-3 text-[11px] font-mono whitespace-pre-wrap leading-relaxed"
          style={{ color: "#64748b", borderTop: "1px solid rgba(99,102,241,0.08)" }}
        >
          {displayText}
        </div>
      )}
    </div>
  );
}

// ── Avatars ───────────────────────────────────────────────────────────────────

function BibbleAvatar({ streaming }: { streaming?: boolean }) {
  return (
    <div
      className="w-8 h-8 rounded-full shrink-0 overflow-hidden"
      style={{
        animation: streaming ? "streamPulse 1.2s ease-in-out infinite" : "breathe 3.5s ease-in-out infinite",
        boxShadow: streaming ? "0 0 14px rgba(99,102,241,0.55)" : "0 0 8px rgba(99,102,241,0.2)",
      }}
    >
      <Image src="/bibbleAlpha.png" alt="Bibble" width={32} height={32} className="w-full h-full object-contain p-0.5" priority />
    </div>
  );
}

/** Avatar para mensagens de agente Onyx: imagem do agente ou ícone padrão (Bot). */
function AgentAvatar({ avatarUrl, name, streaming }: { avatarUrl?: string | null; name?: string | null; streaming?: boolean }) {
  return (
    <div
      className="w-8 h-8 rounded-full shrink-0 overflow-hidden grid place-items-center relative"
      style={{
        background: "rgba(99,102,241,0.15)",
        animation: streaming ? "streamPulse 1.2s ease-in-out infinite" : "breathe 3.5s ease-in-out infinite",
        boxShadow: streaming ? "0 0 14px rgba(99,102,241,0.55)" : "0 0 8px rgba(99,102,241,0.2)",
      }}
    >
      {avatarUrl ? (
        <Image src={avatarUrl} alt={name ?? "Agente"} fill unoptimized className="object-cover" />
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4" /><line x1="8" y1="16" x2="8" y2="16" /><line x1="16" y1="16" x2="16" y2="16" />
        </svg>
      )}
    </div>
  );
}

function UserAvatar({ initials }: { initials: string }) {
  return (
    <div
      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
      style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}
    >
      <span className="font-black text-[10px]" style={{ color: "#a5b4fc" }}>{initials}</span>
    </div>
  );
}

// ── File helpers ──────────────────────────────────────────────────────────────

function FileIcon({ fileType, size = 16 }: { fileType: string; size?: number }) {
  if (fileType.includes("image"))  return <ImageIcon size={size} className="text-[#a5b4fc]" />;
  if (fileType.includes("video"))  return <Video size={size} className="text-[#c4b5fd]" />;
  if (fileType.includes("pdf"))    return <FileText size={size} style={{ color: "#818cf8" }} />;
  if (fileType.includes("excel") || fileType.includes("spreadsheet")) return <File size={size} className="text-[#6ee7b7]" />;
  return <File size={size} className="text-[#a5b4fc]" />;
}

function extractPdfUrl(content: string): string | null {
  const match = content.match(/https:\/\/[^\s\)]+\.pdf[^\s\)]*/);
  return match ? match[0] : null;
}

function PdfDownloadButton({ url, label }: { url: string; label?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 mt-3 px-4 py-2.5 rounded-xl transition-all group"
      style={{
        background: "linear-gradient(135deg, #1e3a5f 0%, #1e2d4a 100%)",
        border: "1px solid rgba(59,130,246,0.3)",
        boxShadow: "0 2px 12px rgba(59,130,246,0.15)",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="12" y1="18" x2="12" y2="12"/>
        <polyline points="9 15 12 18 15 15"/>
      </svg>
      <span className="text-[12px] font-semibold text-blue-300 group-hover:text-white transition-colors">
        {label ?? "📄 Abrir Ficha PDF"}
      </span>
    </a>
  );
}

function formatTime(date?: Date): string {
  if (!date) return "";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ── Markdown prose ────────────────────────────────────────────────────────────

const PROSE_CLASSES = cn(
  "prose prose-invert max-w-none",
  "prose-p:my-2 prose-p:leading-[1.75] prose-p:text-[#d1d5db] prose-p:text-[13.5px]",
  "prose-headings:text-[#f1f5f9] prose-headings:font-bold prose-headings:tracking-tight prose-headings:mt-4 prose-headings:mb-1.5",
  "prose-h1:text-[15px] prose-h2:text-[14px] prose-h3:text-[13px]",
  "prose-strong:text-[#f1f5f9] prose-strong:font-semibold",
  "prose-em:text-[#c4b5fd]",
  "prose-ul:my-2 prose-ul:pl-5 prose-ol:my-2 prose-ol:pl-5",
  "prose-li:my-0.5 prose-li:text-[13.5px] prose-li:text-[#d1d5db] prose-li:leading-[1.7]",
  "prose-code:text-[#7dd3fc] prose-code:bg-[rgba(30,45,74,0.7)] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[12px] prose-code:font-mono",
  "prose-code:before:content-none prose-code:after:content-none",
  "prose-pre:p-0 prose-pre:bg-transparent prose-pre:my-0",
  "prose-blockquote:border-l-2 prose-blockquote:border-[#6366f1] prose-blockquote:bg-[rgba(30,41,59,0.4)] prose-blockquote:text-[#a5b4fc] prose-blockquote:pl-4 prose-blockquote:py-1 prose-blockquote:rounded-r prose-blockquote:not-italic",
  "prose-hr:border-[#334155] prose-hr:my-3",
  "prose-a:text-[#818cf8] prose-a:no-underline hover:prose-a:underline",
  "prose-table:text-[12.5px] prose-th:text-[#f1f5f9] prose-th:font-semibold prose-td:text-[#d1d5db]",
  "prose-thead:border-b-[#334155] prose-tr:border-b-[rgba(30,45,74,0.5)]",
);

// ── Markdown components (módulo-level para refs estáveis — evita loop) ────────

const REMARK_PLUGINS = [remarkGfm] as Parameters<typeof ReactMarkdown>[0]["remarkPlugins"];

const MARKDOWN_COMPONENTS: Parameters<typeof ReactMarkdown>[0]["components"] = {
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const codeStr = String(children).replace(/\n$/, "");
    const lang    = /language-(\w+)/.exec(className ?? "")?.[1];
    const isBlock = codeStr.includes("\n") || !!lang;
    if (isBlock) return <CodeBlock code={codeStr} language={lang} />;
    return <code className={className}>{codeStr}</code>;
  },
  // Imagens (ex: geradas por agente) — renderiza responsivo, abre em nova aba
  img: ({ src, alt }) => {
    const url = typeof src === "string" ? src : "";
    if (!url) return null;
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block my-2">
        <Image
          src={url}
          alt={typeof alt === "string" ? alt : "imagem"}
          width={768}
          height={768}
          unoptimized
          className="rounded-xl"
          style={{ width: "100%", height: "auto", maxWidth: 420, border: "1px solid rgba(99,102,241,0.2)" }}
        />
      </a>
    );
  },
};

// ── Main component ────────────────────────────────────────────────────────────

export default function BibbleMessageBubble({
  message,
  userName,
  agentActive,
  agentAvatarUrl,
  agentName,
}: {
  message: Message;
  userName: string;
  agentActive?: boolean;
  agentAvatarUrl?: string | null;
  agentName?: string | null;
}) {
  const isUser   = message.role === "user";
  const initials = userName.substring(0, 2).toUpperCase();
  const timeStr  = formatTime(message.createdAt);

  // Extrai e limpa arquivos do conteúdo da mensagem do usuário
  const attachedFiles: Array<{ name: string; type: string }> = [];
  let cleanedContent = message.content;

  const fileRegex = /📎 ([^\n]+)/gi;
  let fMatch;
  while ((fMatch = fileRegex.exec(cleanedContent)) !== null) {
    const name = fMatch[1].trim();
    const typeMatch = message.content.match(/\(([^)]+)\)/);
    const type = typeMatch ? typeMatch[1].trim().replace(/[()]/g, "").replace(/\s+/g, "/") : "desconhecido";
    attachedFiles.push({ name, type });
  }

  cleanedContent = cleanedContent
    .replace(/^\[Arquivos: (.*?)\]\n\n?/, "")
    .replace(/^\[Arquivos anexados: (.*?)\]\n\n?/, "")
    .replace(/\n\n\n+/g, "\n\n");

  // ── Mensagem do usuário ─────────────────────────────────────────────────

  if (isUser) {
    return (
      <div
        className="flex justify-end items-start gap-2.5 group"
        style={{ animation: "msgSlideIn 180ms ease-out" }}
      >
        <div className="max-w-[76%] relative">
          <div
            style={{
              background: "rgba(30,64,175,0.18)",
              border: "1px solid rgba(59,130,246,0.28)",
              borderRadius: "18px 18px 4px 18px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div className="px-4 py-2.5 space-y-2">
              {attachedFiles.length > 0 && (
                <div className="space-y-1">
                  {attachedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 p-2 rounded-lg"
                      style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.18)" }}
                    >
                      {FileIcon({ fileType: file.type, size: 14 })}
                      <p className="text-[11px] font-medium truncate opacity-90">{file.name}</p>
                    </div>
                  ))}
                </div>
              )}
              <p
                className="text-[14px] whitespace-pre-wrap leading-relaxed"
                style={{ color: "#f1f5f9" }}
              >
                {cleanedContent.replace(/\[Arquivos:.*?\]/, "") || message.content}
              </p>
            </div>
          </div>
          {timeStr && (
            <time
              className="absolute -bottom-5 right-1 text-[10px] opacity-0 group-hover:opacity-60 select-none pointer-events-none transition-opacity"
              style={{ color: "#94a3b8" }}
            >
              {timeStr}
            </time>
          )}
        </div>
        <UserAvatar initials={initials} />
      </div>
    );
  }

  // ── Mensagem do assistente ─────────────────────────────────────────────

  const pdfUrl = !message.streaming ? extractPdfUrl(message.content) : null;

  return (
    <div
      className="flex items-start gap-2.5 group"
      style={{ animation: "msgSlideIn 180ms ease-out" }}
    >
      {agentActive
        ? <AgentAvatar avatarUrl={agentAvatarUrl} name={agentName} streaming={message.streaming} />
        : <BibbleAvatar streaming={message.streaming} />}

      <div className="flex-1 min-w-0">

        {message.streaming ? (
          /* ── Modo streaming: compacto, sem card header ─────────────
             Ocupa menos altura, deixa as mensagens anteriores visíveis.
             Estilo inspirado no ChatGPT: borda esquerda + texto fluindo. */
          <div
            style={{
              borderLeft: "2px solid rgba(99,102,241,0.45)",
              paddingLeft: "14px",
            }}
          >
            {/* Label "Gerando" compacto */}
            <div className="flex items-center gap-1.5 mb-2">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{
                  background: "#818cf8",
                  boxShadow: "0 0 5px rgba(129,140,248,0.8)",
                  animation: "cursorBlink 1s ease-in-out infinite",
                }}
              />
              <span
                className="text-[10px] font-bold tracking-widest uppercase"
                style={{ color: "#6366f1", opacity: 0.75 }}
              >
                Gerando
              </span>
            </div>

            {message.thinkContent && (
              <ThinkingBlock content={message.thinkContent} streaming />
            )}

            <div className={PROSE_CLASSES}>
              <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
                {message.content}
              </ReactMarkdown>

              {/* Cursor piscante ao final do texto */}
              <span
                className="inline-block w-[2px] h-[1em] ml-0.5 align-middle rounded-sm"
                style={{
                  background: "#6366f1",
                  boxShadow: "0 0 6px rgba(99,102,241,.7)",
                  animation: "cursorBlink 1s ease-in-out infinite",
                }}
              />
            </div>
          </div>

        ) : (
          /* ── Modo done: card completo ──────────────────────────────
             Aparece quando a IA termina. Header com nome + copiar. */
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "rgba(13,20,40,0.85)",
              border: "1px solid rgba(99,102,241,0.16)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.35), 0 0 0 0.5px rgba(99,102,241,0.08)",
              backdropFilter: "blur(12px)",
              animation: "msgSlideIn 200ms ease-out",
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{
                background: "rgba(15,25,50,0.7)",
                borderBottom: "1px solid rgba(99,102,241,0.1)",
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "#6366f1" }}
                />
                <span className="text-[11px] font-bold tracking-wide" style={{ color: "#6366f1" }}>
                  {agentActive ? (agentName ?? "Agente") : "Bibble"}
                </span>
              </div>
              <CopyButton text={message.content} label="Copiar resposta" />
            </div>

            {/* Conteúdo */}
            <div className="px-5 py-4">
              {message.thinkContent && (
                <ThinkingBlock content={message.thinkContent} streaming={false} />
              )}

              <div className={PROSE_CLASSES}>
                <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
                  {message.content}
                </ReactMarkdown>
              </div>

              {pdfUrl && <PdfDownloadButton url={pdfUrl} />}
            </div>
          </div>
        )}

        {/* Timestamp — só no modo done */}
        {timeStr && !message.streaming && (
          <time
            className="mt-1 ml-1 block text-[10px] opacity-0 group-hover:opacity-50 select-none pointer-events-none transition-opacity"
            style={{ color: "#94a3b8" }}
          >
            {timeStr}
          </time>
        )}
      </div>
    </div>
  );
}
