import type { ElementAnimation } from "./tipos";

/**
 * Motor de execução do Alpha Motion (Fase 01 — Seção 21 do prompt original). Interface
 * estável consumida pelo Editor, preview e player exportado igualmente — nenhuma fase
 * futura (02-10) deve quebrar este contrato, só estender a implementação por trás dele.
 *
 * Backing real é Framer Motion (ver `.bibble/memory/decisions.md`, 2026-08-06) — este
 * arquivo não reimplementa animação do zero, orquestra o que `nucleo.tsx` já faz de forma
 * declarativa, expondo um controle imperativo (play/pause/seek/...) por cima.
 */
export interface AnimationController {
  play(): void;
  pause(): void;
  reverse(): void;
  restart(): void;
  /** `progress` normalizado entre 0 e 1. */
  seek(progress: number): void;
  cancel(): void;
  /** Remove listeners e limpa estilos temporários — deve ser idempotente (seguro chamar mais de uma vez). */
  destroy(): void;
}

export type AnimationPlaybackState = "idle" | "playing" | "paused" | "done" | "cancelled";

/**
 * Estado interno mínimo, independente de framework — permite que futuras implementações
 * (Editor, player exportado) compartilhem a mesma máquina de estados sem duplicar lógica.
 * Fases seguintes (03 em diante) vão ler/escrever este estado ao resolver gatilhos,
 * dependências e stagger.
 */
export class AnimationControllerBase implements AnimationController {
  protected estado: AnimationPlaybackState = "idle";
  protected progresso = 0;
  protected destruido = false;

  constructor(protected readonly animacao: ElementAnimation) {}

  get state(): AnimationPlaybackState {
    return this.estado;
  }

  get progress(): number {
    return this.progresso;
  }

  play(): void {
    if (this.destruido) return;
    this.estado = "playing";
  }

  pause(): void {
    if (this.destruido || this.estado !== "playing") return;
    this.estado = "paused";
  }

  reverse(): void {
    if (this.destruido) return;
    this.estado = "playing";
  }

  restart(): void {
    if (this.destruido) return;
    this.progresso = 0;
    this.estado = "playing";
  }

  seek(progress: number): void {
    if (this.destruido) return;
    this.progresso = Math.min(1, Math.max(0, progress));
  }

  cancel(): void {
    if (this.destruido) return;
    this.estado = "cancelled";
  }

  destroy(): void {
    if (this.destruido) return;
    this.estado = "idle";
    this.destruido = true;
  }
}

/** Cria um controller a partir de uma `ElementAnimation` — ponto único de fábrica, usado pelo registry. */
export function criarAnimationController(animacao: ElementAnimation): AnimationController {
  return new AnimationControllerBase(animacao);
}
