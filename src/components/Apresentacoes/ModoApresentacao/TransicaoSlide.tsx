"use client";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Transição entre SLIDES inteiros (diferente da animação de entrada de cada
 * componente individual, já coberta por RenderComponente/AnimacaoWrapper).
 * Slide.transicaoEntrada é texto livre no schema — mapeamos os valores conhecidos
 * e caímos em fade como padrão para qualquer valor null/desconhecido.
 */
const VARIANTS_POR_TIPO: Record<string, Variants> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  "slide-horizontal": {
    initial: { opacity: 0, x: 60 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -60 },
  },
};

function variantsPara(transicaoEntrada: string | null): Variants {
  if (!transicaoEntrada) return VARIANTS_POR_TIPO.fade;
  return VARIANTS_POR_TIPO[transicaoEntrada] ?? VARIANTS_POR_TIPO.fade;
}

interface TransicaoSlideProps {
  slideId: string;
  transicaoEntrada: string | null;
  children: ReactNode;
}

export function TransicaoSlide({ slideId, transicaoEntrada, children }: TransicaoSlideProps) {
  const variants = variantsPara(transicaoEntrada);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={slideId}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        style={{ width: "100%", height: "100%" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
