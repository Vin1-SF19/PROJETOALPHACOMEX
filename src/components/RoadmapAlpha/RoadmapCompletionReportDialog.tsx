"use client";

import { useEffect, useState } from "react";
import { Check, Copy, FileText, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { ObterRelatorioConclusaoRoadmap } from "@/actions/RoadmapProduction";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

/**
 * Modal read-only (sem edição) do relatório de conclusão do objetivo — gerado pelo Kowalski na
 * Fase 11/arquivamento. Conteúdo independente do histórico de eventos já mostrado no Sheet de
 * "Detalhes" (RoadmapImplementationRoom): busca sob demanda via ObterRelatorioConclusaoRoadmap.
 */
export function RoadmapCompletionReportDialog({
  objectiveId,
  open,
  onOpenChange,
}: {
  objectiveId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<{
    code: string;
    title: string;
    reportMarkdown: string;
    generatedAt: string | null;
  } | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!open || !objectiveId) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void ObterRelatorioConclusaoRoadmap(objectiveId).then((result) => {
        if (cancelled) return;
        setLoading(false);
        if (!result.success) {
          setError(result.error);
          return;
        }
        setReport(result);
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, objectiveId]);

  async function copiar() {
    if (!report) return;
    await navigator.clipboard.writeText(report.reportMarkdown);
    setCopiado(true);
    toast.success("Relatório copiado");
    setTimeout(() => setCopiado(false), 2000);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setReport(null);
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto border-white/10 bg-[#0b1524] text-slate-100 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5 text-violet-300" /> Relatório de Conclusão
          </DialogTitle>
          <DialogDescription>
            {report
              ? `${report.code} · ${report.title}${report.generatedAt ? ` · gerado em ${formatDate(report.generatedAt)}` : ""}`
              : "Somente leitura — copie o conteúdo se precisar reutilizá-lo."}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500">
            <Loader2 className="animate-spin" size={14} /> Carregando…
          </div>
        )}

        {!loading && error && (
          <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
            {error}
          </p>
        )}

        {!loading && report && (
          <>
            <button
              type="button"
              onClick={() => void copiar()}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
            >
              {copiado ? <Check size={13} /> : <Copy size={13} />}
              {copiado ? "Copiado!" : "Copiar relatório"}
            </button>
            <article className="prose prose-invert prose-slate max-w-none prose-headings:scroll-mt-20 prose-a:text-cyan-400 prose-pre:border prose-pre:border-white/10 prose-pre:bg-slate-950">
              <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
                {report.reportMarkdown}
              </ReactMarkdown>
            </article>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
