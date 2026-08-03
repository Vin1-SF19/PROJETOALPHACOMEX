"use client";

import { useDroppable } from "@dnd-kit/core";
import { useEditorStore } from "../store/useEditorStore";
import { ComponenteNoCanvas } from "./ComponenteNoCanvas";
import type { TemaResumo } from "../ApresentacaoEditor";
import { SlidePortalPreview } from "../RenderEngine/SlidePortalPreview";
import { obterProximoSlide } from "@/lib/apresentacoes/proximo-slide";

const SLIDE_W = 1280;
const SLIDE_H = 720;

interface CanvasAreaProps {
  tema: TemaResumo | null;
}

export function CanvasArea({ tema }: CanvasAreaProps) {
  const componentes = useEditorStore((s) => s.componentes);
  const slides = useEditorStore((s) => s.slides);
  const slideAtivoId = useEditorStore((s) => s.slideAtivoId);
  const zoom = useEditorStore((s) => s.zoom);
  const canvas = useEditorStore((s) => s.canvas);
  const selecionarComponente = useEditorStore((s) => s.selecionarComponente);
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-droppable" });
  const proximoSlide = obterProximoSlide(slides, slideAtivoId);
  const portalProximoSlide = (
    <SlidePortalPreview componentes={proximoSlide?.componentes ?? null} canvas={proximoSlide?.canvas} />
  );

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-auto bg-slate-950 p-12">
      <div
        ref={setNodeRef}
        id="alpha-presentation-canvas"
        onClick={() => selecionarComponente(null)}
        className="relative shrink-0 bg-slate-900 shadow-2xl transition-shadow"
        style={{
          width: canvas.width,
          height: canvas.height,
          transform: `scale(${zoom})`,
          transformOrigin: "center center",
          backgroundColor: canvas.backgroundColor,
          outline: isOver ? "2px dashed rgb(99,102,241)" : "1px solid rgba(255,255,255,0.05)",
          // CSS custom properties do tema aplicado — disponíveis para qualquer componente que
          // queira referenciar var(--tema-cor-*) manualmente. Opt-in: os 7 tipos existentes não
          // são forçados a usar o tema, continuam com suas cores explícitas se já configuradas.
          ...(tema
            ? ({
                "--tema-cor-primaria": tema.corPrimaria,
                "--tema-cor-secundaria": tema.corSecundaria,
                "--tema-cor-accent": tema.corAccent,
              } as React.CSSProperties)
            : {}),
        }}
      >
        <div
          data-editor-only="true"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        {componentes.map((c) => (
          <ComponenteNoCanvas key={c.id} componente={c} portalProximoSlide={portalProximoSlide} />
        ))}

        {componentes.length === 0 && (
          <div data-editor-only="true" className="absolute inset-0 flex items-center justify-center text-sm text-slate-600">
            Arraste um componente da barra lateral para começar
          </div>
        )}
      </div>
    </div>
  );
}

export const CANVAS_DIMENSOES = { w: SLIDE_W, h: SLIDE_H };
