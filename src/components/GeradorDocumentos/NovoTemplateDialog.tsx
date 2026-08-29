"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Upload, FileText, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CriarTemplateViaUpload } from "@/actions/gerador-documentos";

const ACCEPT = ".pdf,.doc,.docx,.odt,.rtf,.txt";
const TIPOS_ACEITOS = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "text/plain",
  "application/rtf",
];

function arquivoValido(file: File): boolean {
  if (file.size === 0) return false;
  if (TIPOS_ACEITOS.includes(file.type)) return true;
  // Alguns navegadores não preenchem `type` corretamente para .rtf/.odt — cai para extensão.
  return /\.(pdf|doc|docx|odt|rtf|txt)$/i.test(file.name);
}

export function NovoTemplateDialog({
  open,
  onOpenChange,
  onCriado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCriado: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPending, startTransition] = useTransition();

  function resetar() {
    setArquivo(null);
    setIsDragging(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function selecionarArquivo(file: File | undefined) {
    if (!file) return;
    if (!arquivoValido(file)) {
      toast.error("Formato não suportado. Envie PDF, DOC, DOCX, ODT, RTF ou TXT.");
      return;
    }
    setArquivo(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    selecionarArquivo(e.dataTransfer.files?.[0]);
  }

  function handleSalvar() {
    if (!arquivo) {
      toast.error("Selecione um documento para criar o template");
      return;
    }

    const formData = new FormData();
    formData.append("arquivo", arquivo);

    startTransition(async () => {
      const resultado = await CriarTemplateViaUpload(formData);

      if (!resultado.success) {
        toast.error(resultado.error);
        return;
      }

      toast.success("Template criado a partir do documento");
      onCriado();
      resetar();
      onOpenChange(false);
    });
  }

  function handleOpenChange(next: boolean) {
    if (isPending) return;
    if (!next) resetar();
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo template de documento</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => selecionarArquivo(e.target.files?.[0])}
            disabled={isPending}
          />

          {isPending ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-neutral-300 py-12 text-center dark:border-neutral-700">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              <div>
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Analisando documento e identificando variáveis...
                </p>
                <p className="mt-1 text-xs text-neutral-400">Isso pode levar alguns segundos.</p>
              </div>
            </div>
          ) : arquivo ? (
            <div className="flex items-center gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <FileText className="h-8 w-8 shrink-0 text-emerald-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">{arquivo.name}</p>
                <p className="text-xs text-neutral-400">{(arquivo.size / 1024).toFixed(0)} KB</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setArquivo(null)} aria-label="Remover arquivo">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-neutral-300 py-12 text-center transition-colors dark:border-neutral-700",
                isDragging && "border-emerald-500 bg-emerald-500/5",
              )}
            >
              <Upload className="h-8 w-8 text-neutral-400" />
              <div>
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Arraste um documento aqui ou clique para selecionar
                </p>
                <p className="mt-1 text-xs text-neutral-400">PDF, DOC, DOCX, ODT, RTF ou TXT — até 10MB</p>
              </div>
            </div>
          )}

          <p className="text-xs text-neutral-400">
            O sistema vai identificar automaticamente as variáveis e cláusulas do documento. Você poderá editar tudo
            depois de criado.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={isPending || !arquivo}>
            {isPending ? "Processando..." : "Criar template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
