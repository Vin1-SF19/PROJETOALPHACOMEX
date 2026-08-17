"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { motion } from "framer-motion";
import { RenderComponenteAnimado } from "@/components/Apresentacoes/Editor/RenderEngine/RenderComponente";
import { EfeitosGlobaisSlide, type AjusteVisualEfeitoGlobal } from "@/components/Apresentacoes/Editor/RenderEngine/EfeitosGlobaisSlide";
import { filtroCss, stylePosicaoAbsoluta } from "@/components/Apresentacoes/Editor/RenderEngine/posicionamento";
import type { ContainerIntroEvent } from "@/lib/apresentacoes/container-intro";
import { CLIP_SLIDE_COMPLETO } from "@/lib/apresentacoes/container-intro";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import { TransicaoSlide } from "./TransicaoSlide";
import { SlidePortalPreview } from "@/components/Apresentacoes/Editor/RenderEngine/SlidePortalPreview";
import type { CanvasConfig } from "@/lib/apresentacoes/canvas";
import type { SlideAnimationConfig } from "@/lib/apresentacoes/animacao/tipos";

export interface SlideApresentacao {
  id: string;
  transicaoEntrada: string | null;
  componentes: ComponenteSlide[];
  canvas: CanvasConfig;
  animacaoConfig?: SlideAnimationConfig;
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
  ajusteVisual: AjusteVisualEfeitoGlobal;
  animacaoConfig?: SlideAnimationConfig;
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
  ajusteVisual,
  animacaoConfig,
}: ComponenteNoSlideProps) {
  const componenteRenderizado = useMemo<ComponenteSlide>(() => {
    if (componente.tipo !== "containerCarga") return componente;

    return {
      ...componente,
      // Container Alpha é uma CAPA — "sempre ocupa todo o palco 16:9" (ver
      // DIMENSOES_CONTAINER_CAPA em container-intro.ts). Uma margem aqui deixava uma borda
      // visível ao redor do container onde o fundo do slide (background animado, etc.)
      // aparecia por baixo antes da hora — sem margem, cobre 100% da tela, como documentado.
      x: 0,
      y: 0,
      w: canvas.width,
      h: canvas.height,
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
      <div style={{ width: "100%", height: "100%", opacity: ajusteVisual.opacityAjustada, filter: filtroCss(componenteRenderizado.brilho, ajusteVisual.blurAjustado), transform: ajusteVisual.escalaAjustada ? `scale(${ajusteVisual.escalaAjustada})` : undefined }}>
      <RenderComponenteAnimado
        componente={componenteRenderizado}
        onContainerIntroStart={proximoSlide ? iniciarIntroNoPalco : undefined}
        onContainerIntroComplete={onContainerIntroComplete}
        portalProximoSlide={portalProximoSlide}
        pausado={pausado}
        portalContainerCapa={componenteRenderizado.tipo === "containerCarga" ? undefined : portalContainerCapa}
        animacaoConfig={animacaoConfig}
      />
      </div>
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
        <EfeitosGlobaisSlide componentes={slide.componentes} animacaoConfig={slide.animacaoConfig}>
          {(componente, ajusteVisual) => (
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
              ajusteVisual={ajusteVisual}
              animacaoConfig={slide.animacaoConfig}
            />
          )}
        </EfeitosGlobaisSlide>
      </TransicaoSlide>
    </motion.div>
  );
}
