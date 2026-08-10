import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import type { SlideAnimationConfig } from "./tipos";
import type { ElementAnimation } from "./tipos";
import { migrarAnimacaoAntiga } from "./migracao";
import { obterAnimacao, type AnimationDefinition } from "./registry";
import { calcularDelaysEfetivos, resolverOrdemExecucao, resolucaoOrdemEhErro } from "./gatilhos";

/**
 * Prova de mecanismo da Fase 01 (Fundação — "Preview básico", Seção 32 do prompt original).
 * Encadeia: leitura do novo `SlideAnimationConfig` → fallback para o formato antigo
 * (`componente.animacao`, via `migrarAnimacaoAntiga`) → resolução contra o registry central.
 *
 * Este é o ÚNICO ponto que decide "de onde vem a animação de um elemento" — a Fase 02 vai
 * expandir o catálogo consumido aqui (hoje só a entrada `fade` de prova existe no registry),
 * e futuramente plugar isto em `nucleo.tsx`/`RenderComponente.tsx` para substituir o caminho
 * direto ao `configAnimacaoCompletaSchema`. Nesta fase, `RenderComponente.tsx` e `nucleo.tsx`
 * permanecem INTOCADOS — continuam renderizando via Framer Motion direto no schema antigo,
 * exatamente como hoje. Este resolver funciona em paralelo, sem ainda estar no caminho de
 * render real, provando que a leitura + fallback + registry funcionam encadeados.
 */
export interface AnimacaoResolvida {
  animacao: ElementAnimation;
  definicao: AnimationDefinition | undefined;
  origem: "novo-modelo" | "migrado-formato-antigo";
}

/**
 * Resolve as animações de UM componente do slide, priorizando `animacaoConfig.timeline`
 * (novo modelo) quando presente; caso contrário, migra `componente.animacao` (formato
 * anterior a esta fila) em runtime, sem tocar o dado persistido.
 */
export function resolverAnimacoesDoElemento(
  componente: ComponenteSlide,
  animacaoConfig: SlideAnimationConfig | undefined,
): AnimacaoResolvida[] {
  const timeline = animacaoConfig?.timeline?.animations ?? [];
  const resolucao = resolverOrdemExecucao(timeline);
  const ordenadas = resolucaoOrdemEhErro(resolucao)
    ? [...timeline].sort((a, b) => a.order - b.order)
    : resolucao.ordenadas;
  const delaysEfetivos = calcularDelaysEfetivos(ordenadas);
  const doNovoModelo = ordenadas
    .filter((anim) => anim.elementId === componente.id)
    .map((anim) => ({ ...anim, delay: delaysEfetivos.get(anim.id) ?? anim.delay }));

  if (doNovoModelo.length > 0) {
    return doNovoModelo.map((animacao) => ({
      animacao,
      definicao: obterAnimacao(animacao.type),
      origem: "novo-modelo" as const,
    }));
  }

  // Fallback: componente sem entrada no novo modelo — migra o formato antigo (ou array
  // vazio se o componente também não tiver `animacao` configurado, caso mais comum hoje).
  const migradas = migrarAnimacaoAntiga(componente.id, componente.animacao);
  return migradas.map((animacao) => ({
    animacao,
    definicao: obterAnimacao(animacao.type),
    origem: "migrado-formato-antigo" as const,
  }));
}
