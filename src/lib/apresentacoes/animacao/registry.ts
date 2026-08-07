import type { ElementAnimation, EasingConfig, AnimationCategoria } from "./tipos";
import { criarAnimationController, type AnimationController } from "./motor";

/**
 * Registry central do Alpha Motion (Fase 01 — Seção 20 do prompt original). Todo tipo de
 * animação/transição/efeito das Fases 02-09 é UMA entrada aqui — Editor, preview e player
 * exportado consomem exclusivamente este registry, nunca implementação duplicada em
 * paralelo (Seção 2, regra 9 do prompt original).
 */
export interface AnimationDefinition {
  id: string;
  name: string;
  category: AnimationCategoria | "transition";
  description: string;
  defaultDuration: number;
  defaultEasing: EasingConfig;
  supportedProperties: string[];
  createAnimation: (element: HTMLElement, config: ElementAnimation) => AnimationController;
}

const registro = new Map<string, AnimationDefinition>();

export function registrarAnimacao(definicao: AnimationDefinition): void {
  registro.set(definicao.id, definicao);
}

export function obterAnimacao(id: string): AnimationDefinition | undefined {
  return registro.get(id);
}

export function listarAnimacoes(categoria?: AnimationDefinition["category"]): AnimationDefinition[] {
  const todas = Array.from(registro.values());
  return categoria ? todas.filter((def) => def.category === categoria) : todas;
}

/**
 * Prova de mecanismo da Fase 01 — mantida por compatibilidade com quem já referencia "fade".
 * Catálogo completo (Fase 02, ~68 animações) vive em `./catalogo.ts` — quem for consumir o
 * registry populado deve importar `./catalogo` (side-effect only) uma vez, tipicamente no
 * ponto de entrada do Editor/player (evita import circular: catalogo.ts já importa deste
 * arquivo para chamar `registrarAnimacao`).
 */
registrarAnimacao({
  id: "fade",
  name: "Fade",
  category: "entrance",
  description: "Aparece via opacidade, sem movimento.",
  defaultDuration: 0.5,
  defaultEasing: { curva: "easeOut" },
  supportedProperties: ["opacity"],
  createAnimation: (_element, config) => criarAnimationController(config),
});
