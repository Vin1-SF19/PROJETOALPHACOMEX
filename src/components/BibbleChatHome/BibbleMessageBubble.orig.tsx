"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import { ChevronDown, ChevronUp, FileText, Image as ImageIcon, Video, File, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: Array<{
    name: string;
    type: string;
  }>;
  streaming?: boolean;
}

const CODE_COLLAPSE_THRESHOLD = 15;

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const lines = code.split("\n").length;
  const [collapsed, setCollapsed] = useState(lines > CODE_COLLAPSE_THRESHOLD);

  return (
    <div className="relative my-3 rounded-xl overflow-hidden border border-white/[0.08] bg-[#111111]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">
          {language ?? "código"}
        </span>
        {lines > CODE_COLLAPSE_THRESHOLD && (
          <button
            onClick={() => setCollapsed(p => !p)}
            className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-300 transition-colors"
          >
            {collapsed
              ? <><ChevronDown size={11} /> Expandir ({lines} linhas)</>
              : <><ChevronUp size={11} /> Recolher</>
            }
          </button>
        )}
      </div>
      {!collapsed && (
        <pre className="p-4 text-[12px] text-slate-300 overflow-x-auto leading-relaxed font-mono">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

/* Bibble avatar — letter-based, no image dependency */
function BibbleAvatar() {
  return (
    <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/25 flex items-center justify-center shrink-0 mt-0.5">
      <span className="text-blue-400 font-black text-[11px] leading-none">B</span>
    </div>
  );
}

/* User avatar */
function UserAvatar({ initials }: { initials: string }) {
  return (
    <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0 mt-0.5">
      <span className="text-slate-400 font-black text-[10px]">{initials}</span>
    </div>
  );
}

function FileIcon({ fileType, size = 16 }: { fileType: string; size?: number }) {
  if (fileType.includes("image")) return <ImageIcon size={size} className="text-blue-400" />;
  if (fileType.includes("video")) return <Video size={size} className="text-purple-400" />;
  if (fileType.includes("pdf")) return <FileText size={size} className="text-red-400" />;
  if (fileType.includes("excel") || fileType.includes("spreadsheet")) return <File size={size} className="text-green-600" />;
  return <File size={size} className="text-gray-400" />;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function BibbleMessageBubble({
  message,
  userName,
}: {
  message: Message;
  userName: string;
}) {
  const isUser = message.role === "user";
  const initials = userName.substring(0, 2).toUpperCase();

  /* ── Parse attached files from content ────────────────────── */
  const attachedFiles: Array<{ name: string; type: string }> = [];
  let cleanedContent = message.content;

  // Extrair informações de arquivos do texto
  const fileRegex = /📎 ([^(\n]+)/gi;
  let match;
  while ((match = fileRegex.exec(cleanedContent)) !== null) {
    const name = match[1].trim();
    const typeMatch = message.content.match(/\(([^)]+)\)/);
    const type = typeMatch ? typeMatch[1].trim().replace(/[()]/g, "").replace(/\s+/g, "/") : "desconhecido";
    attachedFiles.push({ name, type });
  }

  // Remover prefixo de arquivos do conteúdo
  cleanedContent = cleanedContent
    .replace(/^\[Arquivos: (.*?)\]\n\n?/, "")
    .replace(/^\[Arquivos anexados: (.*?)\]\n\n?/, "")
    .replace(/\n\n\n+/g, "\n\n");

  /* ── User bubble ───────────────────────────────────────────── */
  if (isUser) {
    return (
      <div className="flex justify-end items-start gap-2.5 group">
        <div className="max-w-[75%] bg-white/[0.05] border border-white/[0.07] rounded-[18px_18px_4px_18px] px-4 py-2.5 space-y-2">
          {/* Files preview */}
          {attachedFiles.length > 0 && (
            <div className="space-y-1">
              {attachedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]"
                >
                  {FileIcon({ fileType: file.type, size: 14 })}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">{file.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-[13px] text-slate-200 whitespace-pre-wrap leading-relaxed">
            {cleanedContent.replace(/\[Arquivos:.*?\]/, "") || message.content}
          </p>
        </div>
        <UserAvatar initials={initials} />
      </div>
    );
  }

  /* ── Bibble response ──────────────────────────────────────── */
  return (
    <div className="flex items-start gap-2.5 group">
      <BibbleAvatar />
      <div
        className={cn(
          "flex-1 min-w-0",
          "prose prose-invert prose-sm max-w-none",
          "prose-p:my-1.5 prose-p:leading-relaxed prose-p:text-slate-200 prose-p:text-[13px]",
          "prose-headings:text-white prose-headings:font-black prose-headings:tracking-tight",
          "prose-h1:text-base prose-h2:text-[13px] prose-h3:text-[12px]",
          "prose-strong:text-white prose-strong:font-bold",
          "prose-em:text-slate-300",
          "prose-ul:my-2 prose-ol:my-2",
          "prose-li:my-0.5 prose-li:text-[13px] prose-li:text-slate-200",
          "prose-code:text-pink-400 prose-code:bg-black/30",
          "prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded",
          "prose-code:text-[12px] prose-code:font-mono",
          "prose-code:before:content-none prose-code:after:content-none",
          "prose-pre:p-0 prose-pre:bg-transparent prose-pre:my-0",
          "prose-blockquote:border-blue-500/40 prose-blockquote:text-slate-400",
          "prose-hr:border-white/[0.08]",
          "prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline",
          "prose-table:text-[12px] prose-th:text-white prose-th:font-bold prose-td:text-slate-300"
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            pre: ({ children }) => <>{children}</>,
            code: ({ className, children }) => {
              const codeStr = String(children).replace(/\n$/, "");
              const lang = /language-(\w+)/.exec(className ?? "")?.[1];
              const isBlock = codeStr.includes("\n");
              if (isBlock) return <CodeBlock code={codeStr} language={lang} />;
              return <code className={className}>{codeStr}</code>;
            },
          }}
        >
          {message.content}
        </ReactMarkdown>

        {/* Streaming dots */}
        {message.streaming && (
          <span className="inline-flex gap-0.5 ml-1 align-middle">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="w-1 h-1 rounded-full bg-slate-500 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
