"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ContainerCargaRender } from "@/components/Apresentacoes/Editor/RenderEngine/ContainerCargaRender";
import { SlidePortalPreview } from "@/components/Apresentacoes/Editor/RenderEngine/SlidePortalPreview";
import { criarComponenteEntradaContainerAlpha, type EntradaApresentacaoConfig } from "@/lib/apresentacoes/entrada-apresentacao";
import { CLIP_SLIDE_COMPLETO, criarClipInicialAbertura, criarClipInicialContainer, type ContainerIntroEvent } from "@/lib/apresentacoes/container-intro";
import type { SlideApresentacao } from "./SlideApresentacaoLayer";

interface EntradaContainerAlphaLayerProps {
  configuracao: EntradaApresentacaoConfig;
  slideInicial: Pick<SlideApresentacao, "componentes" | "canvas">;
  pausado: boolean;
  onComplete: () => void;
}

export function EntradaContainerAlphaLayer({
  configuracao,
  slideInicial,
  pausado,
  onComplete,
}: EntradaContainerAlphaLayerProps) {
  const [intro, setIntro] = useState<ContainerIntroEvent | null>(null);
  const componente = useMemo(
    () => criarComponenteEntradaContainerAlpha(configuracao, slideInicial.canvas),
    [configuracao, slideInicial.canvas],
  );
  const iniciarIntro = useCallback((evento: ContainerIntroEvent) => {
    setIntro(evento);
  }, []);
  const clipInicial = intro?.abertura
    ? criarClipInicialAbertura(intro.abertura, intro.palco)
    : intro
      ? criarClipInicialContainer(intro.componente, intro.palco)
      : CLIP_SLIDE_COMPLETO;

  return (
    <div className="absolute inset-0 z-[150] overflow-hidden bg-black" aria-label="Animação de entrada Container Alpha">
      {intro && (
        <motion.div
          initial={{ clipPath: clipInicial, scale: 0.96 }}
          animate={{ clipPath: CLIP_SLIDE_COMPLETO, scale: 1 }}
          transition={{ duration: intro.duracao, ease: [0.45, 0, 0.2, 1] }}
          className="absolute inset-0 z-[1] overflow-hidden"
        >
          <SlidePortalPreview componentes={slideInicial.componentes} canvas={slideInicial.canvas} />
        </motion.div>
      )}
      <ContainerCargaRender
        componente={componente}
        modo="apresentacao"
        onIntroStart={iniciarIntro}
        onIntroComplete={onComplete}
        portalProximoSlide={(
          <SlidePortalPreview componentes={slideInicial.componentes} canvas={slideInicial.canvas} />
        )}
        pausado={pausado}
      />
    </div>
  );
}
