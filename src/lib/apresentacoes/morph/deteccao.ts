import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import { elegivelParaMorph } from "./elegibilidade";

export interface ParMorph {
  origem: ComponenteSlide;
  destino: ComponenteSlide;
  /** `true` quando o par não pode usar `layoutId` de verdade (tipo não elegível, tipos incompatíveis) — cai em fallback Crossfade. */
  necessitaFallback: boolean;
}

export interface ErroDeteccaoMorph {
  sharedElementId: string;
  motivo: string;
}

export interface ResultadoDeteccaoMorph {
  pares: ParMorph[];
  erros: ErroDeteccaoMorph[];
}

/** Coleta recursiva (mesmo padrão de `coletarIds`, `slide-componentes.ts`) de componentes com `sharedElementId` não-nulo. */
function coletarComSharedElementId(lista: ComponenteSlide[], acc: ComponenteSlide[] = []): ComponenteSlide[] {
  for (const c of lista) {
    if (c.sharedElementId) acc.push(c);
    if (c.tipo === "card" || c.tipo === "grid" || c.tipo === "container") coletarComSharedElementId(c.filhos, acc);
  }
  return acc;
}

/** Agrupa por `sharedElementId`, retornando também os ids que aparecem mais de uma vez (duplicados no mesmo slide). */
function agruparPorSharedId(componentes: ComponenteSlide[]): { porId: Map<string, ComponenteSlide[]>; duplicados: string[] } {
  const porId = new Map<string, ComponenteSlide[]>();
  for (const c of componentes) {
    const id = c.sharedElementId!;
    const lista = porId.get(id) ?? [];
    lista.push(c);
    porId.set(id, lista);
  }
  const duplicados = Array.from(porId.entries())
    .filter(([, lista]) => lista.length > 1)
    .map(([id]) => id);
  return { porId, duplicados };
}

/**
 * Detecta pares de elementos compartilhados entre dois slides consecutivos (Fase 06 —
 * Seção 22 do prompt original, passo 1). Nunca lança exceção — `sharedElementId` duplicado
 * no mesmo slide vira entrada em `erros` (Seção 29: nunca escolher arbitrariamente qual usar).
 * Um id presente só de um lado (origem OU destino, não os dois) não é par nem erro — é o
 * caso normal de "elemento não persiste para o próximo slide".
 */
export function encontrarParesCompartilhados(
  componentesAtual: ComponenteSlide[],
  componentesProximo: ComponenteSlide[],
): ResultadoDeteccaoMorph {
  const origens = coletarComSharedElementId(componentesAtual);
  const destinos = coletarComSharedElementId(componentesProximo);

  const { porId: origensPorId, duplicados: duplicadosOrigem } = agruparPorSharedId(origens);
  const { porId: destinosPorId, duplicados: duplicadosDestino } = agruparPorSharedId(destinos);

  const erros: ErroDeteccaoMorph[] = [
    ...duplicadosOrigem.map((id) => ({ sharedElementId: id, motivo: "sharedElementId duplicado no slide de origem" })),
    ...duplicadosDestino.map((id) => ({ sharedElementId: id, motivo: "sharedElementId duplicado no slide de destino" })),
  ];

  const idsComErro = new Set(erros.map((e) => e.sharedElementId));
  const pares: ParMorph[] = [];

  for (const [id, listaOrigem] of origensPorId) {
    if (idsComErro.has(id)) continue; // duplicado — não forma par, já reportado em erros
    const listaDestino = destinosPorId.get(id);
    if (!listaDestino || listaDestino.length !== 1) continue; // só existe de um lado, ou destino também duplicado (já em erros)

    const origem = listaOrigem[0];
    const destino = listaDestino[0];
    const tiposIncompativeis = origem.tipo !== destino.tipo;
    const algumNaoElegivel = !elegivelParaMorph(origem) || !elegivelParaMorph(destino);

    pares.push({ origem, destino, necessitaFallback: tiposIncompativeis || algumNaoElegivel });
  }

  return { pares, erros };
}
