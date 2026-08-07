"use client";

import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { VARIANTS_BASICAS, resolverTransicaoRica, clipPathParaWipe, type TransicaoBasicaTipo } from "@/lib/apresentacoes/transicoes/catalogo";
import type { SlideTransition } from "@/lib/apresentacoes/animacao/tipos";

/**
 * Transição entre SLIDES inteiros (diferente da animação de entrada de cada
 * componente individual, já coberta por RenderComponente/AnimacaoWrapper).
 * Slide.transicaoEntrada é texto livre no schema — mapeamos os valores conhecidos
 * e caímos em fade como padrão para qualquer valor null/desconhecido.
 *
 * Fase 05 (Alpha Motion) expandiu o catálogo Básico (`VARIANTS_BASICAS`,
 * `src/lib/apresentacoes/transicoes/catalogo.ts`) e adicionou a prop opcional
 * `transicaoRica` para as famílias Wipe/Zoom cinematográfico/Background — Push NÃO está
 * coberto aqui ainda (precisa renderizar os DOIS slides simultaneamente, incompatível com
 * `AnimatePresence mode="wait"` desta estrutura; documentado como limitação desta fase,
 * ver relatório da Fase 05 em `.bibble/memory/decisions.md`).
 */
const VARIANTS_LEGADAS: Record<string, Variants> = {
  fade: VARIANTS_BASICAS.fade,
  "slide-horizontal": {
    initial: { opacity: 0, x: 60 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -60 },
  },
};

function variantsPara(transicaoEntrada: string | null): Variants {
  if (!transicaoEntrada) return VARIANTS_BASICAS.fade;
  const tipo = transicaoEntrada as TransicaoBasicaTipo;
  return VARIANTS_LEGADAS[transicaoEntrada] ?? VARIANTS_BASICAS[tipo] ?? VARIANTS_BASICAS.fade;
}

interface TransicaoSlideProps {
  slideId: string;
  transicaoEntrada: string | null;
  /** Transição rica (Wipe/Zoom cinematográfico/Background) — Fase 05, opcional, sem quebrar retrocompatibilidade. */
  transicaoRica?: SlideTransition;
  children: ReactNode;
  pausado?: boolean;
}

export function TransicaoSlide({ slideId, transicaoEntrada, transicaoRica, children, pausado = false }: TransicaoSlideProps) {
  const reducedMotion = useReducedMotion();
  const resolucaoRica = transicaoRica ? resolverTransicaoRica(transicaoRica) : null;

  // Wipe usa clip-path animado — nunca deforma o conteúdo (Seção 4 do prompt original).
  if (resolucaoRica?.familia === "wipe" && !reducedMotion && !pausado) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={slideId}
          initial={{ clipPath: clipPathParaWipe(resolucaoRica.tipo, 0) }}
          animate={{ clipPath: clipPathParaWipe(resolucaoRica.tipo, 1) }}
          exit={{ clipPath: clipPathParaWipe(resolucaoRica.tipo, 0) }}
          transition={{ duration: transicaoRica?.duration ?? 0.5, ease: "easeInOut" }}
          style={{ width: "100%", height: "100%" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    );
  }

  const variants =
    resolucaoRica?.familia === "zoom-cinematografico"
      ? resolucaoRica.variants
      : variantsPara(transicaoEntrada);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={slideId}
        initial={pausado ? false : "initial"}
        animate="animate"
        exit="exit"
        variants={variants}
        transition={{ duration: reducedMotion || pausado ? 0.01 : (transicaoRica?.duration ?? 0.4), ease: "easeInOut" }}
        style={{ width: "100%", height: "100%" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
