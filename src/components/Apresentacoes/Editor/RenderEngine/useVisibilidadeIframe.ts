import { useEffect, useRef, useState } from "react";

/**
 * `document.visibilityState` não reflete a visibilidade real de um módulo
 * renderizado dentro do iframe do painel (PainelLayoutClient.tsx) — só
 * IntersectionObserver é confiável aqui. Usado para pausar o frameloop de
 * `<Canvas>` do React Three Fiber quando o componente 3D está fora de tela,
 * evitando gasto de GPU/CPU com renderização que ninguém está vendo.
 */
export function useVisibilidadeIframe<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visivel, setVisivel] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisivel(entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visivel };
}
