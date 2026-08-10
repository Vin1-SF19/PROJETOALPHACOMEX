import { useEffect, type RefObject } from "react";

/**
 * Observa a largura real (renderizada) de um elemento via ResizeObserver e reporta via
 * callback. Usado para sincronizar o posicionamento de elementos `fixed` irmãos com o tamanho
 * real de outro elemento, em vez de duplicar valores fixos (px) que podem dessincronizar se o
 * CSS de um dos dois lados mudar ou falhar em aplicar (ex: classe Tailwind não gerada/cache
 * stale do dev server) — a barra global de notas depende disso para nunca sobrepor a sidebar,
 * mesmo se a largura real dela não bater com o valor "esperado".
 */
export function useElementWidth(ref: RefObject<HTMLElement | null>, onWidthChange: (width: number) => void) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const relatarLargura = () => {
      const visivel = getComputedStyle(el).display !== "none";
      onWidthChange(visivel ? el.getBoundingClientRect().width : 0);
    };

    relatarLargura();
    const observer = new ResizeObserver(relatarLargura);
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onWidthChange deve ser estável (useCallback) no chamador; incluí-lo recriaria o observer a cada render
  }, [ref]);
}
