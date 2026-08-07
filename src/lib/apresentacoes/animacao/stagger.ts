import type { StaggerConfig } from "./tipos";

export interface ItemStaggerResolvido {
  id: string;
  delay: number;
}

/** Embaralha uma cópia do array (Fisher-Yates) — usa `Math.random()`, portanto não determinístico entre renders (documentado). */
function embaralhar<T>(itens: T[]): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** Reordena `itemIds` conforme `StaggerOrdem` (Seção 10 do prompt original), sem calcular delay ainda. */
function reordenarPorConfig(itemIds: string[], config: StaggerConfig): string[] {
  switch (config.ordem) {
    case "first-to-last":
      return itemIds;
    case "last-to-first":
      return [...itemIds].reverse();
    case "center-out": {
      const meio = Math.floor(itemIds.length / 2);
      const resultado: string[] = [];
      for (let offset = 0; offset <= meio; offset += 1) {
        if (meio - offset >= 0 && meio + offset < itemIds.length) {
          if (meio - offset !== meio + offset) resultado.push(itemIds[meio - offset], itemIds[meio + offset]);
          else resultado.push(itemIds[meio]);
        } else if (meio - offset >= 0) {
          resultado.push(itemIds[meio - offset]);
        } else if (meio + offset < itemIds.length) {
          resultado.push(itemIds[meio + offset]);
        }
      }
      return resultado;
    }
    case "edges-in": {
      const resultado: string[] = [];
      let esquerda = 0;
      let direita = itemIds.length - 1;
      while (esquerda <= direita) {
        resultado.push(itemIds[esquerda]);
        if (esquerda !== direita) resultado.push(itemIds[direita]);
        esquerda += 1;
        direita -= 1;
      }
      return resultado;
    }
    case "random":
      return embaralhar(itemIds);
    case "manual":
      if (!config.ordemManual || config.ordemManual.length === 0) return itemIds;
      // Preserva só ids realmente presentes em `itemIds` — nunca inventa item inexistente (Seção 29, config antiga/inválida cai em fallback seguro).
      return config.ordemManual.filter((id) => itemIds.includes(id));
    default:
      return itemIds;
  }
}

/**
 * Calcula o delay de cada item em cascata (Fase 03 — Seção 10 do prompt original).
 * `itensSimultaneos` (quando > 1) agrupa itens no mesmo delay — cada grupo avança
 * `intervalo` segundos em relação ao grupo anterior, em vez de cada item individual.
 */
export function calcularOrdemStagger(itemIds: string[], config: StaggerConfig): ItemStaggerResolvido[] {
  if (itemIds.length === 0) return [];

  const ordenados = reordenarPorConfig(itemIds, config);
  const porGrupo = Math.max(1, config.itensSimultaneos ?? 1);

  return ordenados.map((id, index) => {
    const grupo = Math.floor(index / porGrupo);
    return { id, delay: grupo * config.intervalo };
  });
}
