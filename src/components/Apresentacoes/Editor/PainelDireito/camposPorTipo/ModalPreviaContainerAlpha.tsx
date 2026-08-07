"use client";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ContainerCargaRender } from "@/components/Apresentacoes/Editor/RenderEngine/ContainerCargaRender";
import type { ContainerCargaComponente } from "@/lib/validations/slide-componentes";

interface ModalPreviaContainerAlphaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  componente: ContainerCargaComponente;
}

/** Prévia ampliada (tamanho de slide) do Container Alpha — mesma proporção/estilo de modal já usado em ModalVisualizadorHtml.tsx. */
export function ModalPreviaContainerAlpha({ open, onOpenChange, componente }: ModalPreviaContainerAlphaProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="aspect-video h-auto w-[min(96vw,1440px,163.555dvh)] max-w-none gap-0 overflow-hidden rounded-2xl border-white/10 bg-slate-950 p-0 shadow-2xl sm:max-w-none"
      >
        <DialogTitle className="sr-only">Prévia ampliada do Container Alpha</DialogTitle>
        <DialogDescription className="sr-only">
          Prévia em tamanho de slide do container usado na abertura da apresentação — cores, metal, interior e marca.
        </DialogDescription>
        {open && <ContainerCargaRender componente={componente} modo="editor" />}
      </DialogContent>
    </Dialog>
  );
}
