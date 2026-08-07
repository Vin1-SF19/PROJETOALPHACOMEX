"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ContainerCargaRender } from "@/components/Apresentacoes/Editor/RenderEngine/ContainerCargaRender";
import { SlidePortalPreview } from "@/components/Apresentacoes/Editor/RenderEngine/SlidePortalPreview";
import {
  criarComponenteAnimacaoContainerAlpha,
  type ConfigAnimacaoContainerAlpha,
} from "@/lib/apresentacoes/animacao-container-alpha";
import {
  CLIP_SLIDE_COMPLETO,
  criarClipInicialAbertura,
  criarClipInicialContainer,
  type ContainerIntroEvent,
} from "@/lib/apresentacoes/container-intro";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import type { CanvasConfig } from "@/lib/apresentacoes/canvas";

interface TransicaoContainerAlphaLayerProps {
  configuracao: ConfigAnimacaoContainerAlpha;
  canvasPalco?: CanvasConfig;
  slideDestino: {
    componentes: ComponenteSlide[] | null;
    canvas: CanvasConfig;
  };
  pausado: boolean;
  onZoomStart?: (evento: ContainerIntroEvent) => void;
  onComplete: () => void;
  /** Repassado direto para `ContainerCargaRender` — ver documentação lá. Default `true`. */
  deverIniciar?: boolean;
}

export function TransicaoContainerAlphaLayer({
  configuracao,
  slideDestino,
  canvasPalco = slideDestino.canvas,
  pausado,
  onZoomStart,
  onComplete,
  deverIniciar = true,
}: TransicaoContainerAlphaLayerProps) {
  const [intro, setIntro] = useState<ContainerIntroEvent | null>(null);
  const componente = useMemo(
    () => criarComponenteAnimacaoContainerAlpha(configuracao, canvasPalco),
    [canvasPalco, configuracao],
  );
  // Container Alpha é uma CAPA — "sempre ocupa todo o palco 16:9" (ver comentário de
  // DIMENSOES_CONTAINER_CAPA em container-intro.ts). Uma margem aqui deixa uma borda visível
  // ao redor do container (preta durante a abertura, ou o background do slide vazando por
  // baixo em usos futuros) — sem margem, o container cobre 100% da tela, como documentado.
  const margem = 0;
  const iniciarIntro = useCallback((evento: ContainerIntroEvent) => {
    const escalaX = (canvasPalco.width - margem * 2) / (evento.palco?.w ?? canvasPalco.width);
    const escalaY = (canvasPalco.height - margem * 2) / (evento.palco?.h ?? canvasPalco.height);
    const converterParaPalco = (dimensoes: { x: number; y: number; w: number; h: number }) => ({
      x: margem + dimensoes.x * escalaX,
      y: margem + dimensoes.y * escalaY,
      w: dimensoes.w * escalaX,
      h: dimensoes.h * escalaY,
    });
    const eventoNoPalco: ContainerIntroEvent = {
      ...evento,
      palco: { w: canvasPalco.width, h: canvasPalco.height },
      componente: {
        ...evento.componente,
        ...converterParaPalco(evento.componente),
      },
      abertura: evento.abertura ? converterParaPalco(evento.abertura) : undefined,
    };
    setIntro(eventoNoPalco);
    onZoomStart?.(eventoNoPalco);
  }, [canvasPalco.height, canvasPalco.width, margem, onZoomStart]);
  const clipInicial = intro?.abertura
    ? criarClipInicialAbertura(intro.abertura, intro.palco)
    : intro
      ? criarClipInicialContainer(intro.componente, intro.palco)
      : CLIP_SLIDE_COMPLETO;

  return (
    <div
      role="img"
      aria-label="Transição de slide Container Alpha"
      className="absolute inset-0 z-[150] overflow-hidden bg-black"
    >
      {intro && (
        <motion.div
          initial={{ clipPath: clipInicial, scale: 0.96 }}
          animate={{ clipPath: CLIP_SLIDE_COMPLETO, scale: 1 }}
          transition={{ duration: intro.duracao, ease: [0.45, 0, 0.2, 1] }}
          className="absolute inset-0 z-[1] overflow-hidden"
        >
          <SlidePortalPreview componentes={slideDestino.componentes} canvas={slideDestino.canvas} />
        </motion.div>
      )}
      <div className="absolute z-[2]" style={{ inset: margem }}>
        <ContainerCargaRender
          componente={componente}
          modo="apresentacao"
          onIntroStart={iniciarIntro}
          onIntroComplete={onComplete}
          portalProximoSlide={(
            <SlidePortalPreview componentes={slideDestino.componentes} canvas={slideDestino.canvas} />
          )}
          pausado={pausado}
          deverIniciar={deverIniciar}
        />
      </div>
    </div>
  );
}
