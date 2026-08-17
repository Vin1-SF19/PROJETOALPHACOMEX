"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useLazyColumn — observa um elemento via IntersectionObserver e devolve
 * `inView: true` quando o elemento entra a `threshold` px do viewport.
 *
 * Uso típico: lazy-load de colunas fora do viewport em pipelines/kanbans.
 *
 * @param threshold - distância em px antes do viewport (padrão 200)
 * @returns [ref, inView]
 */
export function useLazyColumn(threshold = 200): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Se IntersectionObserver não existe (SSR/ambiente antigo), assume inView
    if (typeof IntersectionObserver === "undefined") {
      const fallback = window.setTimeout(() => setInView(true), 0);
      return () => window.clearTimeout(fallback);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect(); // só precisa disparar uma vez
        }
      },
      { rootMargin: `${threshold}px` },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, inView];
}
