"use client";

import { motion } from "framer-motion";
import { RenderComponente } from "@/components/Apresentacoes/Editor/RenderEngine/RenderComponente";
import { stylePosicaoAbsoluta } from "@/components/Apresentacoes/Editor/RenderEngine/posicionamento";
import type { ContainerIntroEvent } from "@/lib/apresentacoes/container-intro";
import { CLIP_SLIDE_COMPLETO } from "@/lib/apresentacoes/container-intro";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import { TransicaoSlide } from "./TransicaoSlide";
import { SlidePortalPreview } from "@/components/Apresentacoes/Editor/RenderEngine/SlidePortalPreview";
import type { CanvasConfig } from "@/lib/apresentacoes/canvas";
import type { EntradaApresentacaoConfig } from "@/lib/apresentacoes/entrada-apresentacao";

export interface SlideApresentacao {
  id: string;
  transicaoEntrada: string | null;
  componentes: ComponenteSlide[];
  canvas: CanvasConfig;
  entradaApresentacao: EntradaApresentacaoConfig | null;
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
        {slide.componentes.map((componente) => {
          const componenteRenderizado = componente.tipo === "containerCarga"
            ? { ...componente, x: 0, y: 0, w: slide.canvas.width, h: slide.canvas.height }
            : componente;

          return (
            <div key={componente.id} style={stylePosicaoAbsoluta(componenteRenderizado)}>
              <RenderComponente
                componente={componenteRenderizado}
                onContainerIntroStart={proximoSlide ? onContainerIntroStart : undefined}
                onContainerIntroComplete={onContainerIntroComplete}
                portalProximoSlide={portalProximoSlide}
                pausado={pausado}
                portalContainerCapa={portalContainerCapa}
              />
            </div>
          );
        })}
      </TransicaoSlide>
    </motion.div>
  );
}
