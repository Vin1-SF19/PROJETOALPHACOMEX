import type { ComponenteSlide } from "@/lib/validations/slide-componentes";
import type { RegistryEntry } from "./registry-tipos";
import { REGISTRY_BASICOS } from "./registry-basicos";
import { REGISTRY_FORMAS } from "./registry-formas";
import { REGISTRY_MOLDURAS } from "./registry-molduras";
import { REGISTRY_3D } from "./registry-3d";
import { REGISTRY_DADOS } from "./registry-dados";
import { REGISTRY_BUSINESS } from "./registry-business";
import { REGISTRY_IA } from "./registry-ia";
import { REGISTRY_FUNDOS } from "./registry-fundos";

export type { RegistryEntry } from "./registry-tipos";
/**
 * "fundoAnimado" é excluído do lado esquerdo porque não existe como chave própria no
 * registry — só existe através das 7 chaves nomeadas de REGISTRY_FUNDOS (ver
 * registry-fundos.ts), todas produzindo `ComponenteSlide` com `tipo: "fundoAnimado"`.
 * Mesmo padrão para "forma"/"moldura": as chaves de REGISTRY_FORMAS/REGISTRY_MOLDURAS (ver
 * registry-formas.ts/registry-molduras.ts) são as VARIANTES, todas produzindo `ComponenteSlide`
 * com `tipo: "forma"`/`tipo: "moldura"` respectivamente.
 */
export type TipoComponente =
  | Exclude<ComponenteSlide["tipo"], "fundoAnimado" | "forma" | "moldura">
  | keyof typeof REGISTRY_FUNDOS
  | keyof typeof REGISTRY_FORMAS
  | keyof typeof REGISTRY_MOLDURAS;

export const COMPONENTES_REGISTRY: Record<TipoComponente, RegistryEntry> = {
  ...REGISTRY_BASICOS,
  ...REGISTRY_FORMAS,
  ...REGISTRY_MOLDURAS,
  ...REGISTRY_3D,
  ...REGISTRY_DADOS,
  ...REGISTRY_BUSINESS,
  ...REGISTRY_IA,
  ...REGISTRY_FUNDOS,
};

export const TIPOS_COMPONENTE: TipoComponente[] = Object.keys(COMPONENTES_REGISTRY) as TipoComponente[];

export function ehTipoFundo(tipo: TipoComponente): tipo is keyof typeof REGISTRY_FUNDOS {
  return tipo in REGISTRY_FUNDOS;
}

/** Categorias para agrupamento na sidebar do Editor. */
export const CATEGORIAS_COMPONENTE = [
  { nome: "Básicos", tipos: Object.keys(REGISTRY_BASICOS) as TipoComponente[] },
  { nome: "Elementos", tipos: Object.keys(REGISTRY_FORMAS) as TipoComponente[] },
  { nome: "Molduras", tipos: Object.keys(REGISTRY_MOLDURAS) as TipoComponente[] },
  { nome: "3D", tipos: Object.keys(REGISTRY_3D) as TipoComponente[] },
  { nome: "Dados", tipos: Object.keys(REGISTRY_DADOS) as TipoComponente[] },
  { nome: "Business", tipos: Object.keys(REGISTRY_BUSINESS) as TipoComponente[] },
  { nome: "IA", tipos: Object.keys(REGISTRY_IA) as TipoComponente[] },
  { nome: "Backgrounds", tipos: Object.keys(REGISTRY_FUNDOS) as TipoComponente[] },
] as const;
