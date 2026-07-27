"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Node, Edge } from "@xyflow/react";

interface GerarLayoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  accent: string;
  onAplicar: (nodes: Node[], edges: Edge[]) => void;
}

export function GerarLayoutModal({ open, onOpenChange, projectId, accent, onAplicar }: GerarLayoutModalProps) {
  const [ideia, setIdeia] = useState("");
  const [gerando, setGerando] = useState(false);
  const [statusAtual, setStatusAtual] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);

  async function gerar() {
    if (!ideia.trim() || gerando) return;
    setGerando(true);
    setResultado(null);
    setStatusAtual(null);

    try {
      const resp = await fetch("/api/blueprint/gerar-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ideia: ideia.trim() }),
      });

      if (!resp.ok || !resp.body) {
        toast.error("Não foi possível gerar o layout");
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
          if (evento.type === "done") setResultado({ nodes: evento.nodes, edges: evento.edges });
          if (evento.type === "error") toast.error(evento.message);
        }
      }
    } catch {
      toast.error("Erro de conexão ao gerar layout");
    } finally {
      setGerando(false);
      setStatusAtual(null);
    }
  }

  function aplicar() {
    if (!resultado) return;
    onAplicar(resultado.nodes, resultado.edges);
    setResultado(null);
    setIdeia("");
    onOpenChange(false);
  }

  function descartar() {
    setResultado(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-950/95 backdrop-blur-2xl border-white/10 rounded-3xl max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Sparkles size={16} style={{ color: `rgb(${accent})` }} />
            Gerar layout com IA
          </DialogTitle>
        </DialogHeader>

        {!resultado ? (
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Descreva a ideia</label>
              <textarea
                value={ideia}
                onChange={(e) => setIdeia(e.target.value)}
                placeholder="Ex: fluxo de cadastro de cliente com aprovação, ou grid com as telas de login, dashboard e relatório"
                rows={4}
                className="w-full rounded-xl bg-slate-900/60 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-white/20 resize-none"
                maxLength={2000}
                autoFocus
              />
            </div>

            <button
              onClick={gerar}
              disabled={gerando || !ideia.trim()}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60"
              style={{ background: `rgba(${accent},0.9)` }}
            >
              {gerando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {gerando ? (statusAtual ?? "Gerando...") : "Gerar layout"}
            </button>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <p className="text-xs text-slate-400">
              {resultado.nodes.length} elemento(s) prontos para adicionar ao canvas. Revise antes de aplicar.
            </p>
            <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3 max-h-48 overflow-y-auto space-y-1">
              {resultado.nodes.map((n) => (
                <p key={n.id} className="text-xs text-slate-300">
                  • {(n.data as { nome?: string; texto?: string })?.nome ?? (n.data as { texto?: string })?.texto ?? "Elemento"}
                </p>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={descartar} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white transition-colors">
                Descartar
              </button>
              <button
                onClick={aplicar}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white"
                style={{ background: `rgba(${accent},0.9)` }}
              >
                Aplicar ao canvas
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
