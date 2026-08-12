"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Download, ExternalLink, FileText, X } from "lucide-react";
import { Dialog, DialogPortal } from "@/components/ui/dialog";

interface AnexoPreview {
  id: string;
  fileName: string;
  mimeType: string;
}

interface AnexoPreviewModalProps {
  anexo: AnexoPreview | null;
  onFechar: () => void;
  accent: string;
}

function formatarUrlAnexo(anexoId: string): string {
  return `/api/notas/anexos/${anexoId}`;
}

export function AnexoPreviewModal({ anexo, onFechar, accent }: AnexoPreviewModalProps) {
  const ehImagem = anexo?.mimeType.startsWith("image/") ?? false;
  const ehPdf = anexo?.mimeType === "application/pdf";
  const url = anexo ? formatarUrlAnexo(anexo.id) : "";

  return (
    <Dialog open={!!anexo} onOpenChange={(open) => !open && onFechar()}>
      <DialogPortal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-[100] grid h-[90vh] w-[calc(100%-1.5rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 grid-rows-[auto_1fr] gap-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl outline-none backdrop-blur-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:h-[85vh] sm:w-full sm:rounded-3xl"
        >
          <div
            className="flex items-center gap-2 border-b p-3 sm:gap-3 sm:p-4"
            style={{ borderColor: `rgba(${accent},0.18)`, background: `linear-gradient(135deg, rgba(${accent},0.14) 0%, rgba(2,6,23,0.4) 100%)` }}
          >
            <div
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-2xl border sm:flex"
              style={{ background: `rgba(${accent},0.2)`, borderColor: `rgba(${accent},0.25)` }}
            >
              <FileText className="h-4 w-4" style={{ color: `rgba(${accent},1)` }} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <DialogPrimitive.Title className="truncate text-xs font-bold text-white sm:text-sm">
                {anexo?.fileName ?? "Anexo"}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 truncate text-[9px] uppercase tracking-wide text-slate-500 sm:text-[10px]">
                {anexo?.mimeType ?? ""}
              </DialogPrimitive.Description>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1">
              <a
                href={url}
                download={anexo?.fileName}
                title="Baixar arquivo"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                <Download size={16} />
              </a>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir em nova guia"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                <ExternalLink size={16} />
              </a>
              <DialogPrimitive.Close
                onClick={onFechar}
                aria-label="Fechar visualização"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <X size={18} />
              </DialogPrimitive.Close>
            </div>
          </div>

          <div className="flex min-h-0 items-center justify-center overflow-auto bg-black/30 p-2 sm:p-4">
            {ehImagem && anexo && (
              // eslint-disable-next-line @next/next/no-img-element -- pré-visualização de arquivo do usuário via rota autenticada, não um asset do projeto (next/image exigiria domínio remoto configurado para um endpoint dinâmico e autenticado)
              <img
                src={url}
                alt={anexo.fileName}
                className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
              />
            )}

            {ehPdf && anexo && (
              <iframe src={url} title={anexo.fileName} className="h-full w-full rounded-xl border border-white/10 bg-white" />
            )}

            {anexo && !ehImagem && !ehPdf && (
              <div className="flex flex-col items-center gap-3 text-center text-slate-400">
                <FileText size={40} className="text-slate-600" aria-hidden="true" />
                <p className="text-sm">Não há pré-visualização disponível para este tipo de arquivo.</p>
                <a
                  href={url}
                  download={anexo.fileName}
                  className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white transition-transform active:scale-95"
                  style={{ background: `rgba(${accent},0.9)` }}
                >
                  <Download size={14} /> Baixar arquivo
                </a>
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
