"use client";

import { useEffect, useRef, useState } from "react";
import { Bug } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { useEditorStore } from "../store/useEditorStore";
import { ComponenteNoCanvas } from "./ComponenteNoCanvas";
import type { TemaResumo } from "../ApresentacaoEditor";
import { SlidePortalPreview } from "../RenderEngine/SlidePortalPreview";
import { EfeitosGlobaisSlide } from "../RenderEngine/EfeitosGlobaisSlide";
import { obterProximoSlide } from "@/lib/apresentacoes/proximo-slide";
import { GuiasAlinhamento } from "./GuiasAlinhamento";

const SLIDE_W = 1280;
const SLIDE_H = 720;

interface CanvasAreaProps {
  tema: TemaResumo | null;
}

export function CanvasArea({ tema }: CanvasAreaProps) {
  const [debugPptx, setDebugPptx] = useState(false);
  const componentes = useEditorStore((s) => s.componentes);
  const slides = useEditorStore((s) => s.slides);
  const slideAtivoId = useEditorStore((s) => s.slideAtivoId);
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const canvas = useEditorStore((s) => s.canvas);
  const animacaoConfig = useEditorStore((s) => s.animacaoConfig);
  const selecionarComponente = useEditorStore((s) => s.selecionarComponente);
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-droppable" });
  const areaVisualizacaoRef = useRef<HTMLDivElement>(null);
  const proximoSlide = obterProximoSlide(slides, slideAtivoId);
  const portalProximoSlide = (
    <SlidePortalPreview componentes={proximoSlide?.componentes ?? null} canvas={proximoSlide?.canvas} />
  );

  // Mantém o slide enquadrado quando o formato ou a área útil mudam. O ResizeObserver
  // cobre resize da janela, zoom do sistema e redistribuição das barras laterais.
  useEffect(() => {
    const area = areaVisualizacaoRef.current;
    if (!area) return;

    const ajustarParaCaber = () => {
      const estilo = window.getComputedStyle(area);
      const larguraDisponivel = area.clientWidth - Number.parseFloat(estilo.paddingLeft) - Number.parseFloat(estilo.paddingRight);
      const alturaDisponivel = area.clientHeight - Number.parseFloat(estilo.paddingTop) - Number.parseFloat(estilo.paddingBottom);
      if (larguraDisponivel <= 0 || alturaDisponivel <= 0) return;
      const zoomIdeal = Math.min(1, larguraDisponivel / canvas.width, alturaDisponivel / canvas.height);
      setZoom(Number(zoomIdeal.toFixed(2)));
    };

    const resizeObserver = new ResizeObserver(ajustarParaCaber);
    resizeObserver.observe(area);
    return () => resizeObserver.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setZoom é uma ação estável do Zustand
  }, [canvas.width, canvas.height]);

  return (
    <div ref={areaVisualizacaoRef} className="relative flex h-full w-full items-center justify-center overflow-auto bg-slate-950 p-4 lg:p-8 2xl:p-12">
      <button
        type="button"
        data-editor-only="true"
        onClick={() => setDebugPptx((current) => !current)}
        aria-pressed={debugPptx}
        className={`absolute right-4 top-4 z-50 flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ${debugPptx ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200" : "border-white/10 bg-slate-900/80 text-slate-400 hover:text-white"}`}
      >
        <Bug size={13} aria-hidden="true" />
        Debug PPTX
      </button>
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
          backgroundImage: canvas.backgroundImage,
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
        <EfeitosGlobaisSlide componentes={componentes} animacaoConfig={animacaoConfig}>
          {(c, ajuste) => (
            <ComponenteNoCanvas key={c.id} componente={c} portalProximoSlide={portalProximoSlide} ajusteVisual={ajuste} />
          )}
        </EfeitosGlobaisSlide>
        <GuiasAlinhamento />

        {debugPptx && componentes.filter((component) => component.pptxOrigem).map((component) => (
          <div
            key={`debug-${component.id}`}
            data-editor-only="true"
            className={`pointer-events-none absolute border ${component.pptxOrigem?.fallback ? "border-amber-400 bg-amber-400/5" : "border-cyan-400/80 bg-cyan-400/[0.03]"}`}
            style={{ left: component.x, top: component.y, width: component.w, height: component.h, zIndex: 100000 }}
          >
            <span className="absolute left-0 top-0 max-w-full -translate-y-full truncate bg-slate-950/90 px-1 py-0.5 font-mono text-[9px] text-cyan-200">
              {component.pptxOrigem?.shapeId ?? "?"} · {component.pptxOrigem?.name ?? component.tipo} · z{component.zIndex} · {Math.round(component.w)}×{Math.round(component.h)}
            </span>
          </div>
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
