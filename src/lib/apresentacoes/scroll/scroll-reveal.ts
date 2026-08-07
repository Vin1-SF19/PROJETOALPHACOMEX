"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Scroll Reveal do Alpha Motion (Fase 08 — Seção 17 do prompt original, recorte pragmático).
 * Único modo de `SlideScrollConfig.mode` implementado nesta fase — scrub/pinned/scrollytelling
 * ficam documentados como limitação (exigiriam trocar a navegação de slides discretos por
 * rolagem contínua, decisão registrada em `.bibble/memory/decisions.md`).
 */
export interface ConfigScrollReveal {
  /** Fração da altura do elemento visível na viewport para considerar "revelado" (0 a 1). */
  percentualVisivel: number;
  /** true = revela uma vez e nunca mais esconde; false = alterna ao entrar/sair (reexecuta ao voltar). */
  executarUmaVez: boolean;
  /** Segundos de espera após cruzar o limiar antes de marcar como revelado. */
  delay: number;
}

export const CONFIG_SCROLL_REVEAL_PADRAO: ConfigScrollReveal = {
  percentualVisivel: 0.3,
  executarUmaVez: true,
  delay: 0,
};

/**
 * Observa `ref` via IntersectionObserver e retorna se o elemento está "revelado" conforme
 * `config`. Nunca lança exceção — em ambiente sem IntersectionObserver (SSR/teste) o fallback
 * é retornar `true` direto, nunca esconder conteúdo permanentemente por falta de suporte
 * (Seção 29 do prompt original, mesma regra de fallback seguro já usada no projeto).
 */
export function useScrollReveal(ref: RefObject<Element | null>, config: ConfigScrollReveal = CONFIG_SCROLL_REVEAL_PADRAO): boolean {
  const [revelado, setRevelado] = useState(() => typeof IntersectionObserver === "undefined");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Fallback SSR/sem-suporte já é o valor inicial do useState acima — nada a fazer aqui.
    if (typeof IntersectionObserver === "undefined") return;

    const elemento = ref.current;
    if (!elemento) return;

    const limparTimeout = () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const observer = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada) return;

        if (entrada.isIntersecting) {
          if (config.delay > 0) {
            limparTimeout();
            timeoutRef.current = setTimeout(() => setRevelado(true), config.delay * 1000);
          } else {
            setRevelado(true);
          }
        } else {
          limparTimeout();
          if (!config.executarUmaVez) setRevelado(false);
        }
      },
      { threshold: Math.min(1, Math.max(0, config.percentualVisivel)) },
    );

    observer.observe(elemento);
    return () => {
      limparTimeout();
      observer.disconnect();
    };
  }, [ref, config.percentualVisivel, config.executarUmaVez, config.delay]);

  return revelado;
}
