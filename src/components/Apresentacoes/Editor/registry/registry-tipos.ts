import type { LucideIcon } from "lucide-react";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";

export interface RegistryEntry {
  label: string;
  icone: LucideIcon;
  /** Quando presente, a sidebar (`ItemComponenteArrastavel.tsx`) mostra esta imagem em vez do
   * ícone — usado pelas molduras/formas com arte própria, onde o usuário precisa VER a
   * ilustração real (não um ícone genérico) para saber qual está escolhendo. */
  imagemPreview?: string;
  criarComponentePadrao: (x: number, y: number) => ComponenteSlide;
}

/** Sem dependência nova: crypto.randomUUID() é nativo (browser e Node 19+). */
export function gerarId(): string {
  return crypto.randomUUID();
}
