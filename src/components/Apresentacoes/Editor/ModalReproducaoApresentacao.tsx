"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

interface ModalReproducaoApresentacaoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apresentacaoId: string;
  titulo: string;
}

export function ModalReproducaoApresentacao({
  open,
  onOpenChange,
  apresentacaoId,
  titulo,
}: ModalReproducaoApresentacaoProps) {
  useEffect(() => {
    if (!open) return;

    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "ALPHA_FECHAR_APRESENTACAO") onOpenChange(false);
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onOpenChange, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="aspect-video h-auto w-[92vw] max-w-[1440px] gap-0 overflow-hidden rounded-2xl border-white/10 bg-black p-0 shadow-2xl sm:max-w-[1440px]"
      >
        <DialogTitle className="sr-only">Reproduzir {titulo}</DialogTitle>
        <DialogDescription className="sr-only">
          Player da apresentação com controles de reprodução, pausa e navegação entre slides.
        </DialogDescription>
        <DialogClose asChild>
          <button
            type="button"
            aria-label="Fechar reprodução"
            className="absolute right-3 top-3 z-50 rounded-full bg-black/70 p-2 text-white/70 shadow-lg hover:bg-black hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </DialogClose>
        {open && (
          <iframe
            src={`/PainelAlpha/Apresentacoes/${apresentacaoId}/apresentar?modal=1`}
            title={`Reprodução da apresentação ${titulo}`}
            allow="autoplay; fullscreen"
            className="h-full w-full border-0 bg-black"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
