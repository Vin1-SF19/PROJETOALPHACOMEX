"use client";

import { useRef, useState } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const PROSE_CLASSES = cn(
  "prose prose-invert prose-sm max-w-none",
  "prose-p:my-1.5 prose-p:leading-relaxed prose-p:text-slate-300",
  "prose-headings:text-white prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1",
  "prose-h1:text-sm prose-h2:text-sm prose-h3:text-xs",
  "prose-strong:text-white prose-strong:font-semibold",
  "prose-ul:my-1.5 prose-ul:pl-4 prose-ol:my-1.5 prose-ol:pl-4",
  "prose-li:my-0.5 prose-li:text-slate-300 prose-li:leading-relaxed",
  "prose-code:text-sky-300 prose-code:bg-white/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs",
  "prose-code:before:content-none prose-code:after:content-none",
  "prose-hr:border-white/10 prose-hr:my-2",
  "prose-a:text-indigo-300",
);

interface MensagemChat {
  role: "user" | "assistant";
  content: string;
}

interface BlueprintAIPanelProps {
  projectId: string;
  accent: string;
}

const SUGESTOES = [
  "Resuma tudo que já foi enviado",
  "Quais partes ainda estão mal explicadas?",
  "Quais perguntas devo responder antes de passar ao desenvolvedor?",
];

export function BlueprintAIPanel({ projectId, accent }: BlueprintAIPanelProps) {
  const [mensagens, setMensagens] = useState<MensagemChat[]>([]);
  const [input, setInput] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [statusAtual, setStatusAtual] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function enviar(texto: string) {
    if (!texto.trim() || carregando) return;
    setMensagens((m) => [...m, { role: "user", content: texto }]);
    setInput("");
    setCarregando(true);
    setStatusAtual(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch("/api/blueprint/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, message: texto }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        setMensagens((m) => [...m, { role: "assistant", content: "Não foi possível processar sua mensagem agora." }]);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let textoFinal = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          if (!frame.startsWith("data: ")) continue;
          const evento = JSON.parse(frame.slice(6));
          if (evento.type === "status") setStatusAtual(evento.message);
          if (evento.type === "text") textoFinal = evento.text;
          if (evento.type === "error") textoFinal = evento.message;
        }
      }

      setMensagens((m) => [...m, { role: "assistant", content: textoFinal || "Sem resposta." }]);
    } catch {
      if (!controller.signal.aborted) {
        setMensagens((m) => [...m, { role: "assistant", content: "Erro de conexão com a IA." }]);
      }
    } finally {
      setCarregando(false);
      setStatusAtual(null);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] rounded-2xl border border-white/5 bg-slate-950/70 backdrop-blur-2xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <Sparkles size={16} style={{ color: `rgb(${accent})` }} />
        <p className="text-sm font-medium text-white">Assistente do projeto</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {mensagens.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500 mb-2">Sugestões:</p>
            {SUGESTOES.map((s) => (
              <button
                key={s}
                onClick={() => enviar(s)}
                className="block w-full text-left text-xs text-slate-400 hover:text-white rounded-lg border border-white/5 px-3 py-2 hover:border-white/10 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {mensagens.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="text-sm rounded-xl px-3 py-2 max-w-[90%] ml-auto bg-white/5 text-white whitespace-pre-wrap">
              {m.content}
            </div>
          ) : (
            <div key={i} className={`${PROSE_CLASSES} max-w-[95%]`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
            </div>
          ),
        )}

        {carregando && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 size={12} className="animate-spin" />
            {statusAtual ?? "Pensando..."}
          </div>
        )}
      </div>

      <div className="flex gap-2 p-3 border-t border-white/5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviar(input)}
          placeholder="Pergunte algo sobre este projeto..."
          type="text"
          name="blueprint-ai-chat-mensagem"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="flex-1 rounded-xl bg-slate-900/60 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none"
          disabled={carregando}
        />
        <button
          onClick={() => enviar(input)}
          disabled={carregando || !input.trim()}
          className="p-2 rounded-xl text-white disabled:opacity-50"
          style={{ background: `rgba(${accent},0.9)` }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
