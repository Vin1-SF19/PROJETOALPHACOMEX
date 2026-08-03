"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModoApresentacaoClient } from "@/components/Apresentacoes/ModoApresentacao/ModoApresentacaoClient";
import type { SlideApresentacao } from "@/components/Apresentacoes/ModoApresentacao/SlideApresentacaoLayer";

interface TemaReproducao {
  id: string;
  nome: string;
  corPrimaria: string;
  corSecundaria: string;
  corAccent: string;
}

interface ModalReproducaoApresentacaoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apresentacaoId: string;
  titulo: string;
  slides: SlideApresentacao[];
  tema: TemaReproducao | null;
}

export function ModalReproducaoApresentacao({
  open,
  onOpenChange,
  apresentacaoId,
  titulo,
  slides,
  tema,
}: ModalReproducaoApresentacaoProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="aspect-video h-auto w-[min(96vw,1440px,163.555dvh)] max-w-none gap-0 overflow-hidden rounded-2xl border-white/10 bg-black p-0 shadow-2xl sm:max-w-none"
      >
        <DialogTitle className="sr-only">Reproduzir {titulo}</DialogTitle>
        <DialogDescription className="sr-only">
          Player da apresentação com controles de reprodução, pausa e navegação entre slides.
        </DialogDescription>
        {open && (
          <ModoApresentacaoClient
            apresentacaoId={apresentacaoId}
            slides={slides}
            tema={tema}
            embutido
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
