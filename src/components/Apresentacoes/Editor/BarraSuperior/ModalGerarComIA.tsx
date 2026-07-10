"use client";

import { useRef, useState } from "react";
import { Loader2, WandSparkles, Check, X, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RenderComponente } from "../RenderEngine/RenderComponente";
import { stylePosicaoAbsoluta } from "../RenderEngine/posicionamento";
import { CANVAS_DIMENSOES } from "../Canvas/CanvasArea";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";

interface EventoSSE {
  type: "status" | "text" | "done" | "error";
  state?: string;
  text?: string;
  componentes?: ComponenteSlide[];
  message?: string;
}

interface ModalGerarComIAProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apresentacaoId: string;
  onAplicar: (componentes: ComponenteSlide[]) => void;
}

const ESCALA_PREVIEW = 0.28;

export function ModalGerarComIA({ open, onOpenChange, apresentacaoId, onAplicar }: ModalGerarComIAProps) {
  const [prompt, setPrompt] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [componentesGerados, setComponentesGerados] = useState<ComponenteSlide[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function fecharEAbortar(novoEstado: boolean) {
    if (!novoEstado) {
      abortRef.current?.abort();
      // Limpa todo o estado ao fechar — sem isso, reabrir o modal mostraria o preview/erro da sessão anterior em vez do textarea limpo.
      setPrompt("");
      setGerando(false);
      resetar();
    }
    onOpenChange(novoEstado);
  }

  async function gerar() {
    if (!prompt.trim() || gerando) return;

    setGerando(true);
    setErro(null);
    setComponentesGerados(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/apresentacoes/gerar-slide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ apresentacaoId, prompt: prompt.trim() }),
      });

      // Erros de auth/validação/ownership (401/400/403) respondem com JSON simples, não SSE —
      // tratar antes de tentar ler o corpo como stream (senão o erro é silenciosamente ignorado).
      if (!res.ok) {
        const corpo = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(corpo?.error ?? `Erro ao gerar o slide (${res.status}).`);
      }

      if (!res.body) throw new Error("Stream sem corpo de resposta");

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6)) as EventoSSE;
            if (evt.type === "done" && evt.componentes) {
              setComponentesGerados(evt.componentes);
            } else if (evt.type === "error") {
              setErro(evt.message ?? "Erro ao gerar o slide.");
            }
          } catch {
            // chunk malformado — ignora, segue lendo
          }
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setErro(err instanceof Error ? err.message : "Erro ao gerar o slide.");
      }
    } finally {
      setGerando(false);
    }
  }

  function handleAplicar() {
    if (!componentesGerados) return;
    onAplicar(componentesGerados);
    resetar();
    onOpenChange(false);
  }

  function resetar() {
    setComponentesGerados(null);
    setErro(null);
  }

  return (
    <Dialog open={open} onOpenChange={fecharEAbortar}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <WandSparkles size={16} aria-hidden="true" /> Gerar slide com IA
          </DialogTitle>
          <DialogDescription>Descreva o slide que você quer e a IA gera o conteúdo para você revisar antes de aplicar.</DialogDescription>
        </DialogHeader>

        {!componentesGerados && (
          <div className="space-y-3 py-2">
            <label htmlFor="prompt-gerar-ia" className="text-[11px] text-slate-400">
              O que este slide deve conter?
            </label>
            <textarea
              id="prompt-gerar-ia"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={gerando}
              placeholder="Ex: crie um slide de abertura para uma proposta comercial da Alpha Comex"
              rows={4}
              className="w-full resize-none rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 disabled:opacity-60"
            />

            {erro && <p className="text-xs text-red-400">{erro}</p>}

            <button
              onClick={gerar}
              disabled={gerando || !prompt.trim()}
              aria-label="Gerar slide com IA"
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {gerando ? (
                <>
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Gerando...
                </>
              ) : (
                <>
                  <WandSparkles size={14} aria-hidden="true" /> Gerar
                </>
              )}
            </button>
          </div>
        )}

        {componentesGerados && (
          <div className="space-y-3 py-2">
            <div
              className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-900"
              style={{ width: CANVAS_DIMENSOES.w * ESCALA_PREVIEW, height: CANVAS_DIMENSOES.h * ESCALA_PREVIEW }}
            >
              <div style={{ transform: `scale(${ESCALA_PREVIEW})`, transformOrigin: "top left", width: CANVAS_DIMENSOES.w, height: CANVAS_DIMENSOES.h, position: "relative" }}>
                {componentesGerados.map((c) => (
                  <div key={c.id} style={stylePosicaoAbsoluta(c)}>
                    <RenderComponente componente={c} />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAplicar}
                aria-label="Aplicar slide gerado"
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                <Check size={14} aria-hidden="true" /> Aplicar
              </button>
              <button
                onClick={resetar}
                aria-label="Gerar outro slide"
                className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:border-white/20"
              >
                <RotateCcw size={14} aria-hidden="true" /> Gerar outro
              </button>
              <button
                onClick={() => fecharEAbortar(false)}
                aria-label="Descartar e fechar"
                className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 hover:border-white/20"
              >
                <X size={14} aria-hidden="true" /> Descartar
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
