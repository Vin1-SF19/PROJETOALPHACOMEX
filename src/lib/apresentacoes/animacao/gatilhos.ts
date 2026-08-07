import type { ElementAnimation } from "./tipos";

/**
 * Resolução de ordem/dependências do Alpha Motion (Fase 03 — Seção 9 do prompt original).
 * Cobre os 10 `AnimationTrigger` (Fase 01) — `on-scroll` só é reconhecido como tipo válido
 * aqui, a lógica real de disparo por rolagem é da Fase 08.
 */

export interface ResolucaoOrdemSucesso {
  ordenadas: ElementAnimation[];
}

export interface ResolucaoOrdemErro {
  erro: string;
  animacaoId: string;
}

export type ResolucaoOrdem = ResolucaoOrdemSucesso | ResolucaoOrdemErro;

function ehErro(resultado: ResolucaoOrdem): resultado is ResolucaoOrdemErro {
  return "erro" in resultado;
}

/**
 * Detecta dependência circular em `dependsOnAnimationId` via DFS com 3 estados por nó
 * (não visitado / na pilha atual / concluído) — nunca recursão sem proteção contra ciclo,
 * sempre O(n) mesmo em grafos com muitos nós.
 */
function detectarCiclo(animations: ElementAnimation[]): string | null {
  const porId = new Map(animations.map((a) => [a.id, a]));
  const estado = new Map<string, "visitando" | "concluido">();

  function dfs(id: string, pilha: Set<string>): string | null {
    if (pilha.has(id)) return id;
    if (estado.get(id) === "concluido") return null;

    pilha.add(id);
    estado.set(id, "visitando");
    const atual = porId.get(id);
    if (atual?.dependsOnAnimationId && porId.has(atual.dependsOnAnimationId)) {
      const cicloEncontrado = dfs(atual.dependsOnAnimationId, pilha);
      if (cicloEncontrado) return cicloEncontrado;
    }
    pilha.delete(id);
    estado.set(id, "concluido");
    return null;
  }

  for (const anim of animations) {
    if (estado.get(anim.id) === "concluido") continue;
    const cicloEncontrado = dfs(anim.id, new Set());
    if (cicloEncontrado) return cicloEncontrado;
  }
  return null;
}

/**
 * Ordena as animações de um elemento/slide respeitando `order` (ordem base), `trigger`
 * (`after-previous` encadeia com a animação anterior por `order`; `with-previous` inicia
 * junto dela) e `dependsOnAnimationId` (grafo de dependência explícito). Nunca lança
 * exceção — dependência circular retorna `ResolucaoOrdemErro` tipado, para o chamador
 * decidir o fallback seguro (nunca travar a apresentação, Seção 29 do prompt original).
 */
export function resolverOrdemExecucao(animations: ElementAnimation[]): ResolucaoOrdem {
  const idCiclo = detectarCiclo(animations);
  if (idCiclo) {
    return { erro: "Dependência circular detectada entre animações.", animacaoId: idCiclo };
  }

  const porId = new Map(animations.map((a) => [a.id, a]));
  for (const anim of animations) {
    if (anim.dependsOnAnimationId && !porId.has(anim.dependsOnAnimationId)) {
      return {
        erro: `Animação depende de "${anim.dependsOnAnimationId}", que não existe nesta timeline.`,
        animacaoId: anim.id,
      };
    }
  }

  // Ordenação estável por `order` — after-previous/with-previous não mudam a ORDEM de
  // execução (isso já é `order`), só o INSTANTE de início (resolvido pelo motor em runtime
  // via delay acumulado, não aqui). Esta função entrega a sequência correta para o motor
  // consumir; o cálculo de tempo real fica em `motor.ts`.
  const ordenadas = [...animations].sort((a, b) => a.order - b.order);
  return { ordenadas };
}

/**
 * Calcula o delay efetivo de cada animação já ordenada, considerando `trigger`:
 * `after-previous` soma a duração da anterior ao seu próprio delay; `with-previous` usa o
 * mesmo instante de início da anterior; os demais triggers usam `delay` como está (o
 * disparo de fato — clique, hover, scroll, etc. — é responsabilidade do motor/UI, não
 * deste cálculo de tempo).
 */
export function calcularDelaysEfetivos(ordenadas: ElementAnimation[]): Map<string, number> {
  const delays = new Map<string, number>();
  let tempoAnterior = 0;
  let duracaoAnterior = 0;

  for (const anim of ordenadas) {
    let delayEfetivo: number;
    if (anim.trigger === "after-previous") {
      delayEfetivo = tempoAnterior + duracaoAnterior + anim.delay;
    } else if (anim.trigger === "with-previous") {
      delayEfetivo = tempoAnterior + anim.delay;
    } else {
      delayEfetivo = anim.delay;
    }
    delays.set(anim.id, delayEfetivo);
    tempoAnterior = delayEfetivo;
    duracaoAnterior = anim.duration;
  }

  return delays;
}

export { ehErro as resolucaoOrdemEhErro };
