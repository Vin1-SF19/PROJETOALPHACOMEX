"use client";

import Image from "next/image";
import { Download, FileWarning, LoaderCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatSize } from "./visual";

export interface ExplorerFilePreview {
  fileName: string;
  sizeBytes: number | null;
  mimeType: string;
  sourceUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

interface FilePreviewDialogProps {
  preview: ExplorerFilePreview | null;
  onClose: () => void;
  onDownload: () => void;
  onRetry: () => void;
}

export function FilePreviewDialog({ preview, onClose, onDownload, onRetry }: FilePreviewDialogProps) {
  return (
    <Dialog open={preview !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="flex h-[min(92dvh,900px)] w-[calc(100vw-1rem)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl border-border/70 bg-background p-0 shadow-2xl sm:w-[min(94vw,1280px)] sm:max-w-none"
      >
        {preview && (
          <>
            <DialogHeader className="shrink-0 border-b border-border/70 bg-card/80 px-4 py-3 pr-14 text-left backdrop-blur-xl sm:px-6 sm:py-4 sm:pr-16">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                  <DialogTitle className="truncate text-base text-foreground sm:text-lg">{preview.fileName}</DialogTitle>
                  <DialogDescription className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 font-medium text-primary">
                      {preview.mimeType.split(";")[0]}
                    </span>
                    <span>{formatSize(preview.sizeBytes)}</span>
                  </DialogDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={onDownload} className="shrink-0 rounded-xl">
                  <Download className="size-4" />
                  <span className="hidden sm:inline">Baixar</span>
                </Button>
              </div>
            </DialogHeader>

            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-muted/20 p-2 sm:p-4">
              {preview.isLoading && <PreviewLoading fileName={preview.fileName} />}
              {!preview.isLoading && preview.error && <PreviewError message={preview.error} onRetry={onRetry} />}
              {!preview.isLoading && !preview.error && preview.sourceUrl && (
                <PreviewContent fileName={preview.fileName} mimeType={preview.mimeType} sourceUrl={preview.sourceUrl} />
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PreviewLoading({ fileName }: { fileName: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 text-center text-muted-foreground">
      <span className="grid size-14 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
        <LoaderCircle className="size-6 animate-spin motion-reduce:animate-none" />
      </span>
      <div>
        <p className="font-medium text-foreground">Abrindo arquivo…</p>
        <p className="mt-1 max-w-sm truncate text-sm">{fileName}</p>
      </div>
    </div>
  );
}

function PreviewError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex max-w-md flex-col items-center gap-4 text-center">
      <span className="grid size-14 place-items-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive">
        <FileWarning className="size-6" />
      </span>
      <div>
        <p className="font-medium text-foreground">Não foi possível mostrar este arquivo</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
      <Button type="button" variant="outline" onClick={onRetry} className="rounded-xl">
        <RotateCcw className="size-4" /> Tentar novamente
      </Button>
    </div>
  );
}

function PreviewContent({ fileName, mimeType, sourceUrl }: { fileName: string; mimeType: string; sourceUrl: string }) {
  if (mimeType === "application/pdf") {
    return <iframe src={`${sourceUrl}#toolbar=1&navpanes=0&view=FitH`} title={`Visualização de ${fileName}`} className="h-full w-full rounded-xl border border-border bg-card" />;
  }
  if (mimeType.startsWith("image/")) {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-xl border border-border bg-card/50">
        <Image src={sourceUrl} alt={fileName} fill unoptimized sizes="94vw" className="object-contain p-2 sm:p-4" />
      </div>
    );
  }
  if (mimeType.startsWith("video/")) {
    return <video src={sourceUrl} controls preload="metadata" className="max-h-full max-w-full rounded-xl bg-card" aria-label={`Vídeo ${fileName}`} />;
  }
  if (mimeType.startsWith("audio/")) {
    return <audio src={sourceUrl} controls preload="metadata" className="w-full max-w-2xl" aria-label={`Áudio ${fileName}`} />;
  }
  return <iframe src={sourceUrl} sandbox="" title={`Conteúdo de ${fileName}`} className="h-full w-full rounded-xl border border-border bg-card" />;
}
