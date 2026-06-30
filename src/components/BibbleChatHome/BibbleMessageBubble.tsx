"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown, ChevronUp, FileText, Image as ImageIcon,
  Video, File, Copy, Check, Lightbulb, Download, X, Maximize2, Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { BotaoFalarMensagem } from "./BotaoFalarMensagem";

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
  files?: Array<{ name: string; type: string; url?: string; size?: number }>;
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

function UserAvatar({ initials, imageUrl }: { initials: string; imageUrl?: string | null }) {
  return (
    <div
      className="w-7 h-7 rounded-lg overflow-hidden grid place-items-center shrink-0 relative"
      style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}
    >
      {imageUrl ? (
        <Image src={imageUrl} alt={initials} fill unoptimized className="object-cover" />
      ) : (
        <span className="font-black text-[10px]" style={{ color: "#a5b4fc" }}>{initials}</span>
      )}
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

function fmtFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function baixarArquivo(url: string, nome: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = nome || "arquivo";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
  } catch {
    // fallback: abre em nova aba
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

// ── Anexos (imagem inline com lightbox + doc como chip) ─────────────────────────

// Lightbox renderizado via PORTAL no <body> — escapa do containing block da
// bolha (que tem backdrop-filter/overflow), garantindo centralização real na tela.
function ImageLightbox({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // trava o scroll do fundo
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => void baixarArquivo(url, name)}
          className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[12px] font-bold flex items-center gap-1.5"
        >
          <Download size={15} /> Baixar
        </button>
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="w-10 h-10 grid place-items-center rounded-xl bg-white/10 hover:bg-white/20 text-white"
        >
          <X size={18} />
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- imagem ampliada (blob/proxy) */}
      <img
        src={url}
        alt={name}
        className="max-w-[92vw] max-h-[88vh] w-auto h-auto object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body,
  );
}

function AnexoPreview({
  files,
}: {
  files: Array<{ name: string; type: string; url?: string; size?: number }>;
}) {
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);

  const imagens = files.filter(f => f.type.startsWith("image/") && f.url);
  const outros = files.filter(f => !f.type.startsWith("image/"));

  if (imagens.length === 0 && outros.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {/* Imagens — grid inline */}
      {imagens.length > 0 && (
        <div className={cn("grid gap-1.5", imagens.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
          {imagens.map((img, idx) => (
            <div
              key={idx}
              className="group/img relative rounded-xl overflow-hidden cursor-pointer flex items-center justify-center"
              style={{ border: "1px solid rgba(99,102,241,0.25)", background: "rgba(10,15,30,0.6)" }}
              onClick={() => setLightbox({ url: img.url!, name: img.name })}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- imagem de anexo (blob externo) */}
              <img
                src={img.url}
                alt={img.name}
                className="max-w-full object-contain"
                style={{ maxHeight: 260 }}
              />
              {/* Overlay com ações no hover */}
              <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover/img:opacity-100">
                <span className="p-2 rounded-lg bg-black/50 text-white" title="Ampliar"><Maximize2 size={16} /></span>
                <button
                  onClick={(e) => { e.stopPropagation(); void baixarArquivo(img.url!, img.name); }}
                  className="p-2 rounded-lg bg-black/50 text-white hover:bg-black/70"
                  title="Baixar"
                >
                  <Download size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Documentos — chip clicável (abre/baixa) */}
      {outros.map((file, idx) => (
        <div
          key={idx}
          className="flex items-center gap-2.5 p-2 rounded-lg"
          style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.18)" }}
        >
          <div className="w-8 h-8 rounded-lg grid place-items-center shrink-0" style={{ background: "rgba(99,102,241,0.15)" }}>
            {FileIcon({ fileType: file.type, size: 15 })}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold truncate" style={{ color: "#e2e8f0" }}>{file.name}</p>
            <p className="text-[9.5px] text-slate-500 uppercase">{file.type.split("/").pop()}{file.size ? ` · ${fmtFileSize(file.size)}` : ""}</p>
          </div>
          {file.url && (
            <button
              onClick={() => void baixarArquivo(file.url!, file.name)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 shrink-0"
              title="Baixar"
            >
              <Download size={14} />
            </button>
          )}
        </div>
      ))}

      {/* Lightbox via portal (centralizado na viewport, fora da bolha) */}
      {lightbox && (
        <ImageLightbox url={lightbox.url} name={lightbox.name} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
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

// ── Sanitização de imagens em markdown ────────────────────────────────────────
// O agente pode emitir ![alt](url) com alt gigante e multi-linha (o prompt
// inteiro). Markdown não aceita alt com quebra de linha → a imagem não renderiza.
// Esta função reescreve qualquer ![...](url) para um alt curto e seguro, sem
// quebras nem caracteres que confundam o parser. Roda antes do ReactMarkdown.
const IMG_MD_RE = /!\[([\s\S]*?)\]\((\/api\/onyx\/file\/[^\s)]+|https?:\/\/[^\s)]+|\/[^\s)]+)\)/g;

function sanitizeImageMarkdown(content: string): string {
  return content.replace(IMG_MD_RE, (_full, alt: string, url: string) => {
    const altLimpo = String(alt)
      .replace(/[\r\n]+/g, " ")
      .replace(/[[\]]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "imagem";
    return `![${altLimpo}](${url})`;
  });
}

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
    return <ImagemRespostaMarkdown url={url} alt={typeof alt === "string" ? alt : "imagem"} />;
  },
};

// Imagem dentro da resposta do assistente: inline + lightbox (portal) + baixar
function ImagemRespostaMarkdown({ url, alt }: { url: string; alt: string }) {
  const [aberto, setAberto] = useState(false);
  const nome = alt && alt !== "imagem" ? alt : "imagem-gerada.png";

  return (
    <>
      <div
        className="group/genimg relative inline-flex items-center justify-center my-2 rounded-xl overflow-hidden cursor-pointer"
        style={{ border: "1px solid rgba(99,102,241,0.2)", maxWidth: 420, background: "rgba(10,15,30,0.6)" }}
        onClick={() => setAberto(true)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- imagem da resposta (proxy onyx/blob) */}
        <img src={url} alt={alt} className="rounded-xl object-contain" style={{ maxWidth: "100%", maxHeight: 420, height: "auto", display: "block" }} />
        <div className="absolute inset-0 bg-black/0 group-hover/genimg:bg-black/25 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover/genimg:opacity-100">
          <span className="p-2 rounded-lg bg-black/50 text-white"><Maximize2 size={16} /></span>
          <button
            onClick={(e) => { e.stopPropagation(); void baixarArquivo(url, nome); }}
            className="p-2 rounded-lg bg-black/50 text-white hover:bg-black/70"
            title="Baixar"
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      {aberto && <ImageLightbox url={url} name={nome} onClose={() => setAberto(false)} />}
    </>
  );
}

// ── User bubble (com edição inline) ───────────────────────────────────────────

function UserBubble({
  message, initials, imageUrl, timeStr, attachedFiles, textoExibido, podeEditar, onEdit,
}: {
  message: Message;
  initials: string;
  imageUrl?: string | null;
  timeStr: string;
  attachedFiles: Array<{ name: string; type: string; url?: string; size?: number }>;
  textoExibido: string;
  podeEditar: boolean;
  onEdit?: (messageId: string, novoTexto: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(textoExibido);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const abrirEdicao = () => {
    setRascunho(textoExibido);
    setEditando(true);
    setTimeout(() => {
      const ta = taRef.current;
      if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    }, 0);
  };

  const confirmar = () => {
    const t = rascunho.trim();
    if (t && t !== textoExibido) onEdit?.(message.id, t);
    setEditando(false);
  };

  return (
    <div
      className="flex justify-end items-start gap-2.5 group"
      style={{ animation: "msgSlideIn 180ms ease-out" }}
    >
      <div className="max-w-[76%] relative">
        {/* Botão de editar — aparece no hover */}
        {podeEditar && !editando && (
          <button
            onClick={abrirEdicao}
            title="Editar mensagem"
            aria-label="Editar mensagem"
            className="absolute -left-9 top-1.5 p-1.5 rounded-lg text-slate-500 hover:text-indigo-300 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all"
          >
            <Pencil size={13} />
          </button>
        )}

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
            {attachedFiles.length > 0 && <AnexoPreview files={attachedFiles} />}

            {editando ? (
              <div className="space-y-2 min-w-[260px]">
                <textarea
                  ref={taRef}
                  value={rascunho}
                  onChange={(e) => setRascunho(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); confirmar(); }
                    if (e.key === "Escape") setEditando(false);
                  }}
                  rows={Math.min(8, Math.max(1, rascunho.split("\n").length))}
                  className="w-full bg-black/30 text-[14px] text-slate-100 rounded-lg p-2 outline-none resize-none border border-indigo-500/30 focus:border-indigo-400/60"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setEditando(false)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmar}
                    disabled={!rascunho.trim() || rascunho.trim() === textoExibido}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Check size={12} /> Enviar
                  </button>
                </div>
              </div>
            ) : (
              textoExibido.trim() && (
                <p className="text-[14px] whitespace-pre-wrap leading-relaxed" style={{ color: "#f1f5f9" }}>
                  {textoExibido}
                </p>
              )
            )}
          </div>
        </div>
        {timeStr && !editando && (
          <time
            className="absolute -bottom-5 right-1 text-[10px] opacity-0 group-hover:opacity-60 select-none pointer-events-none transition-opacity"
            style={{ color: "#94a3b8" }}
          >
            {timeStr}
          </time>
        )}
      </div>
      <UserAvatar initials={initials} imageUrl={imageUrl} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BibbleMessageBubble({
  message,
  userName,
  userImage,
  agentActive,
  agentAvatarUrl,
  agentName,
  onEdit,
  isStreaming,
  accent = "99, 102, 241",
}: {
  message: Message;
  userName: string;
  userImage?: string | null;
  agentActive?: boolean;
  agentAvatarUrl?: string | null;
  agentName?: string | null;
  onEdit?: (messageId: string, novoTexto: string) => void;
  isStreaming?: boolean;
  accent?: string;
}) {
  const isUser   = message.role === "user";
  const initials = userName.substring(0, 2).toUpperCase();
  const timeStr  = formatTime(message.createdAt);

  // Anexos: usa message.files (com url) quando disponível; fallback no regex antigo.
  const attachedFiles: Array<{ name: string; type: string; url?: string; size?: number }> =
    message.files && message.files.length > 0
      ? message.files
      : [];

  let cleanedContent = message.content;
  if (attachedFiles.length === 0) {
    const fileRegex = /📎 ([^\n]+)/gi;
    let fMatch;
    while ((fMatch = fileRegex.exec(cleanedContent)) !== null) {
      const name = fMatch[1].trim();
      const typeMatch = message.content.match(/\(([^)]+)\)/);
      const type = typeMatch ? typeMatch[1].trim().replace(/[()]/g, "").replace(/\s+/g, "/") : "desconhecido";
      attachedFiles.push({ name, type });
    }
  }

  cleanedContent = cleanedContent
    .replace(/^\[Arquivos: (.*?)\]\n\n?/, "")
    .replace(/^\[Arquivos anexados: (.*?)\]\n\n?/, "")
    .replace(/\n\n\n+/g, "\n\n");

  // ── Mensagem do usuário ─────────────────────────────────────────────────

  if (isUser) {
    const textoExibido = cleanedContent.replace(/\[Arquivos:.*?\]/, "") || message.content;
    const podeEditar = !!onEdit && !isStreaming && !message.streaming;
    return (
      <UserBubble
        message={message}
        initials={initials}
        imageUrl={userImage}
        timeStr={timeStr}
        attachedFiles={attachedFiles}
        textoExibido={textoExibido}
        podeEditar={podeEditar}
        onEdit={onEdit}
      />
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
                {sanitizeImageMarkdown(message.content)}
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
              <div className="flex items-center gap-3">
                <BotaoFalarMensagem texto={message.content} accent={accent} />
                <CopyButton text={message.content} label="Copiar resposta" />
              </div>
            </div>

            {/* Conteúdo */}
            <div className="px-5 py-4">
              {message.thinkContent && (
                <ThinkingBlock content={message.thinkContent} streaming={false} />
              )}

              <div className={PROSE_CLASSES}>
                <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>
                  {sanitizeImageMarkdown(message.content)}
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
