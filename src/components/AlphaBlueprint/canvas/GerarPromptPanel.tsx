"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Copy, X, Check, FileText } from "lucide-react";
import { toast } from "sonner";

interface GerarPromptPanelProps {
  projectId: string;
  accent: string;
  onFechar: () => void;
}

/**
 * Gera o prompt de implementação com base no PROJETO INTEIRO (especificação + canvas
 * completo), não em um elemento isolado — acionado a partir do topo do canvas, nunca de
 * dentro do painel de propriedades de um elemento específico.
 */
export function GerarPromptPanel({ projectId, accent, onFechar }: GerarPromptPanelProps) {
  const [carregando, setCarregando] = useState(true);
  const [statusAtual, setStatusAtual] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function gerar() {
      setCarregando(true);
      setPrompt("");
      try {
        const resp = await fetch("/api/blueprint/gerar-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
          signal: controller.signal,
        });

        if (!resp.ok || !resp.body) {
          toast.error("Não foi possível gerar o prompt");
          return;
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

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
            if (evento.type === "done") setPrompt(evento.prompt);
            if (evento.type === "error") toast.error(evento.message);
          }
        }
      } catch {
        if (!controller.signal.aborted) toast.error("Erro de conexão ao gerar prompt");
      } finally {
        setCarregando(false);
        setStatusAtual(null);
      }
    }

    void gerar();
    return () => controller.abort();
  }, [projectId]);

  async function copiar() {
    await navigator.clipboard.writeText(prompt);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="fixed inset-y-0 right-0 z-30 w-full max-w-md bg-slate-950/98 backdrop-blur-2xl border-l border-white/10 shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
        <p className="text-sm font-medium text-white flex items-center gap-2">
          <FileText size={15} />
          Prompt de implementação
        </p>
        <button onClick={onFechar} className="text-slate-500 hover:text-white">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {carregando ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
            <Loader2 size={20} className="animate-spin" />
            <p className="text-xs">{statusAtual ?? "Gerando..."}</p>
          </div>
        ) : (
          <textarea
            readOnly
            value={prompt}
            className="w-full h-full min-h-[60vh] rounded-xl bg-slate-900/60 border border-white/10 p-3 text-xs text-slate-300 font-mono outline-none resize-none"
          />
        )}
      </div>

      {!carregando && prompt && (
        <div className="p-4 border-t border-white/5 shrink-0">
          <button
            onClick={copiar}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-white"
            style={{ background: `rgba(${accent},0.9)` }}
          >
            {copiado ? <Check size={14} /> : <Copy size={14} />}
            {copiado ? "Copiado!" : "Copiar prompt"}
          </button>
        </div>
      )}
    </div>
  );
}
