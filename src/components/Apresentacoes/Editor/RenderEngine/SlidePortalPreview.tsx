"use client";

import { useEffect, useRef, useState } from "react";
import { RenderComponente } from "./RenderComponente";
import { stylePosicaoAbsoluta } from "./posicionamento";
import { MENSAGEM_SEM_PROXIMO_SLIDE } from "@/lib/apresentacoes/proximo-slide";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import { CANVAS_PADRAO, type CanvasConfig } from "@/lib/apresentacoes/canvas";

interface SlidePortalPreviewProps {
  componentes: ComponenteSlide[] | null;
  canvas?: CanvasConfig;
}

/** Render canônico de um slide dentro da abertura do Container Alpha. */
export function SlidePortalPreview({ componentes, canvas = CANVAS_PADRAO }: SlidePortalPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [hostSize, setHostSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => {
      setHostSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  if (componentes === null) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-white px-20 text-center text-[38px] font-semibold text-slate-500">
        {MENSAGEM_SEM_PROXIMO_SLIDE}
      </div>
    );
  }

  const escala = hostSize.width > 0 && hostSize.height > 0
    ? Math.max(hostSize.width / canvas.width, hostSize.height / canvas.height)
    : 0;

  return (
    <div ref={hostRef} className="relative h-full w-full overflow-hidden" style={{ backgroundColor: canvas.backgroundColor, backgroundImage: canvas.backgroundImage }}>
      <div
        className="absolute left-1/2 top-1/2 shrink-0"
        style={{
          width: canvas.width,
          height: canvas.height,
          transform: `translate(-50%, -50%) scale(${escala})`,
          transformOrigin: "center center",
          backgroundColor: canvas.backgroundColor,
          backgroundImage: canvas.backgroundImage,
        }}
      >
        {componentes.map((componente) => (
          <div key={componente.id} style={stylePosicaoAbsoluta(componente)}>
            <RenderComponente componente={componente} modo="editor" />
          </div>
        ))}
      </div>
    </div>
  );
}
