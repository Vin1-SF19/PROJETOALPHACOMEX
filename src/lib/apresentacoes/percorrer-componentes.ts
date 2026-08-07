import type { ComponenteSlide } from "@/lib/validations/slide-componentes";

function ehContainerComFilhos(c: ComponenteSlide): c is Extract<ComponenteSlide, { tipo: "card" | "grid" | "container" }> {
  return c.tipo === "card" || c.tipo === "grid" || c.tipo === "container";
}

/**
 * Coleta, de forma recursiva (incluindo filhos de card/grid/container), todas as URLs de
 * asset externo referenciadas por uma árvore de componentes de slide — imagem/video/audio,
 * textura opcional de globo e modelo `.glb` de objeto3d. Deduplicada (Set), usada pela
 * exportação HTML para saber o que precisa virar `data:` URI antes de embutir.
 */
export function coletarUrlsDeAssets(componentes: ComponenteSlide[]): string[] {
  const urls = new Set<string>();

  function visitar(lista: ComponenteSlide[]) {
    for (const componente of lista) {
      switch (componente.tipo) {
        case "imagem":
        case "video":
        case "audio":
        case "objeto3d":
          if (componente.url) urls.add(componente.url);
          break;
        case "globo":
          if (componente.texturaUrl) urls.add(componente.texturaUrl);
          break;
        default:
          break;
      }
      if (ehContainerComFilhos(componente)) visitar(componente.filhos);
    }
  }

  visitar(componentes);
  return Array.from(urls);
}

/**
 * Retorna uma CÓPIA da árvore de componentes com as URLs de asset trocadas pelo valor
 * correspondente no `mapa` (tipicamente URL remota → `data:` URI base64). Nunca muta a
 * árvore original — o objeto vem direto do Prisma (`Slide.dadosJson`) e não deve ser alterado
 * em memória além do necessário para a resposta desta requisição.
 */
export function substituirUrlsDeAssets(componentes: ComponenteSlide[], mapa: Map<string, string>): ComponenteSlide[] {
  function transformar(componente: ComponenteSlide): ComponenteSlide {
    if (ehContainerComFilhos(componente)) {
      return { ...componente, filhos: componente.filhos.map(transformar) };
    }
    switch (componente.tipo) {
      case "imagem":
      case "video":
      case "audio":
      case "objeto3d": {
        const nova = mapa.get(componente.url);
        return nova ? { ...componente, url: nova } : componente;
      }
      case "globo": {
        const nova = componente.texturaUrl ? mapa.get(componente.texturaUrl) : undefined;
        return nova ? { ...componente, texturaUrl: nova } : componente;
      }
      default:
        return componente;
    }
  }

  return componentes.map(transformar);
}
