import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import type { RegistryEntry } from "./registry-tipos";
import { REGISTRY_BASICOS } from "./registry-basicos";
import { REGISTRY_3D } from "./registry-3d";
import { REGISTRY_DADOS } from "./registry-dados";
import { REGISTRY_BUSINESS } from "./registry-business";
import { REGISTRY_IA } from "./registry-ia";

export type { RegistryEntry } from "./registry-tipos";
export type TipoComponente = ComponenteSlide["tipo"];

export const COMPONENTES_REGISTRY: Record<TipoComponente, RegistryEntry> = {
  ...REGISTRY_BASICOS,
  ...REGISTRY_3D,
  ...REGISTRY_DADOS,
  ...REGISTRY_BUSINESS,
  ...REGISTRY_IA,
};

export const TIPOS_COMPONENTE: TipoComponente[] = Object.keys(COMPONENTES_REGISTRY) as TipoComponente[];

/** Categorias para agrupamento na sidebar do Editor. */
export const CATEGORIAS_COMPONENTE = [
  { nome: "Básicos", tipos: Object.keys(REGISTRY_BASICOS) as TipoComponente[] },
  { nome: "3D", tipos: Object.keys(REGISTRY_3D) as TipoComponente[] },
  { nome: "Dados", tipos: Object.keys(REGISTRY_DADOS) as TipoComponente[] },
  { nome: "Business", tipos: Object.keys(REGISTRY_BUSINESS) as TipoComponente[] },
  { nome: "IA", tipos: Object.keys(REGISTRY_IA) as TipoComponente[] },
] as const;
