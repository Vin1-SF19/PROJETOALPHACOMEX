import type { LucideIcon } from "lucide-react";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";

export interface RegistryEntry {
  label: string;
  icone: LucideIcon;
  criarComponentePadrao: (x: number, y: number) => ComponenteSlide;
}

/** Sem dependência nova: crypto.randomUUID() é nativo (browser e Node 19+). */
export function gerarId(): string {
  return crypto.randomUUID();
}
