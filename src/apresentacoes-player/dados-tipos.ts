import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import type { CanvasConfig } from "@/lib/apresentacoes/canvas";
import type { SlideAnimationConfig } from "@/lib/apresentacoes/animacao/tipos";
import type { FontePersonalizada } from "@/lib/apresentacoes/fontes-personalizadas";

export interface SlideExportado {
  id: string;
  ordem: number;
  transicaoEntrada: string | null;
  componentes: ComponenteSlide[];
  canvas: CanvasConfig;
  /** Fase 08 — necessário no player exportado para resolver ElementAnimation com trigger "on-scroll" (Scroll Reveal). */
  animacaoConfig: SlideAnimationConfig | null;
}

export interface TemaExportado {
  corPrimaria: string;
  corSecundaria: string;
  corAccent: string;
}

export interface DadosApresentacaoExportada {
  titulo: string;
  tema: TemaExportado | null;
  /** Opcional para manter compatibilidade com HTMLs exportados antes da biblioteca de fontes. */
  fontesPersonalizadas?: FontePersonalizada[];
  slides: SlideExportado[];
}

declare global {
  interface Window {
    __ALPHA_APRESENTACAO_DADOS__?: DadosApresentacaoExportada;
  }
}
