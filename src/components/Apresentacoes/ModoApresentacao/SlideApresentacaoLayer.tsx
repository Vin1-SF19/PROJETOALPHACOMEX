"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { motion } from "framer-motion";
import { RenderComponente } from "@/components/Apresentacoes/Editor/RenderEngine/RenderComponente";
import { stylePosicaoAbsoluta } from "@/components/Apresentacoes/Editor/RenderEngine/posicionamento";
import type { ContainerIntroEvent } from "@/lib/apresentacoes/container-intro";
import { CLIP_SLIDE_COMPLETO } from "@/lib/apresentacoes/container-intro";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import { TransicaoSlide } from "./TransicaoSlide";
import { SlidePortalPreview } from "@/components/Apresentacoes/Editor/RenderEngine/SlidePortalPreview";
import type { CanvasConfig } from "@/lib/apresentacoes/canvas";

export interface SlideApresentacao {
  id: string;
  transicaoEntrada: string | null;
  componentes: ComponenteSlide[];
  canvas: CanvasConfig;
}

interface SlideApresentacaoLayerProps {
  slide: SlideApresentacao;
  zIndex: number;
  revelarDoContainer?: boolean;
  clipInicial?: string;
  duracao?: number;
  onContainerIntroStart: (evento: ContainerIntroEvent) => void;
  onContainerIntroComplete: () => void;
  proximoSlide?: SlideApresentacao;
  pausado?: boolean;
  portalContainerCapa?: Element | null;
}

interface ComponenteNoSlideProps {
  componente: ComponenteSlide;
  canvas: CanvasConfig;
  proximoSlide?: SlideApresentacao;
  onContainerIntroStart: (evento: ContainerIntroEvent) => void;
  onContainerIntroComplete: () => void;
  portalProximoSlide: ReactNode;
  pausado: boolean;
  portalContainerCapa?: Element | null;
}

function ComponenteNoSlide({
  componente,
  canvas,
  proximoSlide,
  onContainerIntroStart,
  onContainerIntroComplete,
  portalProximoSlide,
  pausado,
  portalContainerCapa,
}: ComponenteNoSlideProps) {
  const componenteRenderizado = useMemo<ComponenteSlide>(() => {
    if (componente.tipo !== "containerCarga") return componente;

    const menorDimensao = Math.min(canvas.width, canvas.height);
    const margem = Math.min(72, Math.max(18, menorDimensao * 0.05));

    return {
      ...componente,
      x: margem,
      y: margem,
      w: Math.max(1, canvas.width - margem * 2),
      h: Math.max(1, canvas.height - margem * 2),
      // "container-alpha" é a capa anterior ao slide 1. A instância que faz
      // parte do slide não pode disparar outra transição para o slide 2.
      ...(componente.animacao?.entrada?.tipo === "container-alpha"
        ? { transicaoProximoSlide: false }
        : {}),
    };
  }, [canvas.height, canvas.width, componente]);

  const iniciarIntroNoPalco = useCallback((evento: ContainerIntroEvent) => {
    if (componenteRenderizado.tipo !== "containerCarga" || !evento.palco) {
      onContainerIntroStart(evento);
      return;
    }

    const escalaX = componenteRenderizado.w / evento.palco.w;
    const escalaY = componenteRenderizado.h / evento.palco.h;
    const converterParaPalco = (dimensoes: { x: number; y: number; w: number; h: number }) => ({
      x: componenteRenderizado.x + dimensoes.x * escalaX,
      y: componenteRenderizado.y + dimensoes.y * escalaY,
      w: dimensoes.w * escalaX,
      h: dimensoes.h * escalaY,
    });

    onContainerIntroStart({
      ...evento,
      palco: { w: canvas.width, h: canvas.height },
      componente: {
        ...evento.componente,
        ...converterParaPalco(evento.componente),
      },
      abertura: evento.abertura ? converterParaPalco(evento.abertura) : undefined,
    });
  }, [canvas.height, canvas.width, componenteRenderizado, onContainerIntroStart]);

  return (
    <div style={stylePosicaoAbsoluta(componenteRenderizado)}>
      <RenderComponente
        componente={componenteRenderizado}
        onContainerIntroStart={proximoSlide ? iniciarIntroNoPalco : undefined}
        onContainerIntroComplete={onContainerIntroComplete}
        portalProximoSlide={portalProximoSlide}
        pausado={pausado}
        portalContainerCapa={componenteRenderizado.tipo === "containerCarga" ? undefined : portalContainerCapa}
      />
    </div>
  );
}

export function SlideApresentacaoLayer({
  slide,
  zIndex,
  revelarDoContainer = false,
  clipInicial = CLIP_SLIDE_COMPLETO,
  duracao = 0.01,
  onContainerIntroStart,
  onContainerIntroComplete,
  proximoSlide,
  pausado = false,
  portalContainerCapa,
}: SlideApresentacaoLayerProps) {
  const portalProximoSlide = (
    <SlidePortalPreview componentes={proximoSlide?.componentes ?? null} canvas={proximoSlide?.canvas} />
  );

  return (
    <motion.div
      initial={revelarDoContainer ? { clipPath: clipInicial, scale: 0.96 } : false}
      animate={{ clipPath: CLIP_SLIDE_COMPLETO, scale: 1 }}
      transition={{ duration: duracao, ease: [0.45, 0, 0.2, 1] }}
      className="absolute inset-0 overflow-hidden"
      data-slide-export-layer="true"
      style={{ zIndex }}
    >
      <TransicaoSlide slideId={slide.id} transicaoEntrada={slide.transicaoEntrada} pausado={pausado}>
        {slide.componentes.map((componente) => (
          <ComponenteNoSlide
            key={componente.id}
            componente={componente}
            canvas={slide.canvas}
            proximoSlide={proximoSlide}
            onContainerIntroStart={onContainerIntroStart}
            onContainerIntroComplete={onContainerIntroComplete}
            portalProximoSlide={portalProximoSlide}
            pausado={pausado}
            portalContainerCapa={portalContainerCapa}
          />
        ))}
      </TransicaoSlide>
    </motion.div>
  );
}
