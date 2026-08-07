"use client";

import { useRef, type ReactNode } from "react";
import type { ElementAnimation } from "@/lib/apresentacoes/animacao/tipos";
import { useScrollReveal, CONFIG_SCROLL_REVEAL_PADRAO, type ConfigScrollReveal } from "@/lib/apresentacoes/scroll/scroll-reveal";

interface ScrollRevealWrapperProps {
  animacoes: ElementAnimation[];
  children: ReactNode;
}

// Render path, não input de formulário — `customProperties` já passou pelo schema
// permissivo da Fase 01 (`z.record(z.string(), z.unknown())`); aqui é só type-narrowing
// defensivo por campo, não validação de entrada (que já aconteceu na gravação do slide).
function configDaAnimacao(animacao: ElementAnimation): ConfigScrollReveal {
  const props = animacao.customProperties ?? {};
  return {
    percentualVisivel: typeof props.percentualVisivel === "number" ? props.percentualVisivel : CONFIG_SCROLL_REVEAL_PADRAO.percentualVisivel,
    executarUmaVez: typeof props.executarUmaVez === "boolean" ? props.executarUmaVez : CONFIG_SCROLL_REVEAL_PADRAO.executarUmaVez,
    delay: typeof props.delay === "number" ? props.delay : CONFIG_SCROLL_REVEAL_PADRAO.delay,
  };
}

/**
 * Fase 08 — Scroll Reveal (Seção 17 do prompt original, recorte pragmático: só "reveal",
 * ver `.bibble/memory/decisions.md`). Wrapper FINO por componente — ao contrário de
 * `EfeitosGlobaisSlide` (nível de slide, precisa ver os irmãos), Scroll Reveal só precisa
 * saber se O PRÓPRIO elemento tem `trigger: "on-scroll"`, então não há necessidade de operar
 * no nível do slide inteiro.
 *
 * Sem animação "on-scroll": retorna `children` direto, sem `ref`/observer — custo zero para
 * o caso comum (elemento sem scroll reveal configurado).
 */
export function ScrollRevealWrapper({ animacoes, children }: ScrollRevealWrapperProps) {
  const animacaoScroll = animacoes.find((a) => a.trigger === "on-scroll");
  const ref = useRef<HTMLDivElement>(null);
  const config = animacaoScroll ? configDaAnimacao(animacaoScroll) : CONFIG_SCROLL_REVEAL_PADRAO;
  const revelado = useScrollReveal(ref, config);

  if (!animacaoScroll) return <>{children}</>;

  return (
    <div
      ref={ref}
      style={{
        width: "100%",
        height: "100%",
        opacity: revelado ? 1 : 0,
        transform: revelado ? "none" : "translateY(16px)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}
    >
      {children}
    </div>
  );
}
