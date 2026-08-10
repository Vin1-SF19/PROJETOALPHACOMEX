"use client";

import { useState } from "react";
import { Copy, ExternalLink, FileCode, Link2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GerarLinkPublicoApresentacao } from "@/actions/apresentacoes";
import { exportarApresentacaoComoHtml } from "@/lib/apresentacoes/exportacao";

interface ModalExportarApresentacaoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apresentacaoId: string;
  titulo: string;
  slugPublicoInicial: string | null;
  aguardarAntesDeExportar: () => Promise<void>;
}

function montarLink(slug: string): string {
  if (typeof window === "undefined") return `/apresentacao/${slug}`;
  return `${window.location.origin}/apresentacao/${slug}`;
}

export function ModalExportarApresentacao({
  open,
  onOpenChange,
  apresentacaoId,
  titulo,
  slugPublicoInicial,
  aguardarAntesDeExportar,
}: ModalExportarApresentacaoProps) {
  const [slugPublico, setSlugPublico] = useState(slugPublicoInicial);
  const [processando, setProcessando] = useState<"html" | "link" | "renovar" | null>(null);

  async function exportarHtml() {
    setProcessando("html");
    try {
      await aguardarAntesDeExportar();
      await exportarApresentacaoComoHtml(apresentacaoId, titulo);
      toast.success("Apresentação exportada em HTML.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao exportar HTML.");
    } finally {
      setProcessando(null);
    }
  }

  async function gerarLink(renovar: boolean) {
    setProcessando(renovar ? "renovar" : "link");
    try {
      await aguardarAntesDeExportar();
      const resultado = await GerarLinkPublicoApresentacao({ apresentacaoId, renovar });
      if (!resultado.success) throw new Error(resultado.error);
      setSlugPublico(resultado.data.slugPublico);
      toast.success(renovar ? "Novo link gerado; o anterior foi invalidado." : "Link de apresentação publicado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o link.");
    } finally {
      setProcessando(null);
    }
  }

  async function copiarLink() {
    if (!slugPublico) return;
    try {
      await navigator.clipboard.writeText(montarLink(slugPublico));
      toast.success("Link copiado.");
    } catch {
      toast.error("O navegador bloqueou a cópia. Selecione o link manualmente.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-slate-950 text-white sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Exportar apresentação</DialogTitle>
          <DialogDescription className="text-slate-400">
            Baixe um arquivo independente ou publique um link para apresentar diretamente no navegador.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={processando !== null}
            onClick={() => void exportarHtml()}
            className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-left transition hover:border-indigo-400/40 hover:bg-indigo-500/10 disabled:opacity-50"
          >
            <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
              {processando === "html" ? <Loader2 size={18} className="animate-spin" /> : <FileCode size={18} />}
            </span>
            <strong className="block text-sm">Arquivo HTML</strong>
            <span className="mt-1 block text-xs leading-5 text-slate-500">Arquivo autocontido para abrir offline ou enviar como anexo.</span>
          </button>

          <button
            type="button"
            disabled={processando !== null}
            onClick={() => void gerarLink(false)}
            className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-left transition hover:border-sky-400/40 hover:bg-sky-500/10 disabled:opacity-50"
          >
            <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
              {processando === "link" ? <Loader2 size={18} className="animate-spin" /> : <Link2 size={18} />}
            </span>
            <strong className="block text-sm">Link de apresentação</strong>
            <span className="mt-1 block text-xs leading-5 text-slate-500">Publica uma URL sem login, pronta para compartilhar com o público.</span>
          </button>
        </div>

        {slugPublico && (
          <div className="space-y-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <label className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Link publicado</label>
            <div className="flex gap-2">
              <input readOnly value={montarLink(slugPublico)} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-slate-300" />
              <button type="button" onClick={() => void copiarLink()} aria-label="Copiar link" className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10"><Copy size={15} /></button>
              <a href={`/apresentacao/${slugPublico}`} target="_blank" rel="noreferrer" aria-label="Abrir link" className="rounded-lg border border-white/10 p-2 text-slate-300 hover:bg-white/10"><ExternalLink size={15} /></a>
            </div>
            <button type="button" disabled={processando !== null} onClick={() => void gerarLink(true)} className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-white disabled:opacity-50">
              {processando === "renovar" ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Gerar novo link e invalidar o anterior
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
