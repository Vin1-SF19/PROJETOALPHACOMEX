import { Frame } from "lucide-react";
import type { RegistryEntry } from "./registry-tipos";
import { gerarId } from "./registry-tipos";
import { MOLDURA_VARIANTE_TIPOS, type MolduraVarianteTipo } from "@/lib/validations/slide-componentes-basicos";
import { MOLDURAS_CATALOGO } from "@/lib/apresentacoes/molduras-catalogo";

const LARGURA_PADRAO = 240;
const ALTURA_PADRAO = 320;

type ChaveMoldura = `moldura${Capitalize<MolduraVarianteTipo>}`;

function chaveRegistry(variante: MolduraVarianteTipo): ChaveMoldura {
  return `moldura${variante.charAt(0).toUpperCase()}${variante.slice(1)}` as ChaveMoldura;
}

/** Chaves prefixadas com "moldura" (`molduraCirculo`, `molduraCoracao`...) — as variantes têm
 * nomes iguais às de `REGISTRY_FORMAS` (`circulo`, `coracao`...) e as duas entram no mesmo
 * `COMPONENTES_REGISTRY` combinado, então precisam de chaves distintas para não colidir. */
export const REGISTRY_MOLDURAS: Record<ChaveMoldura, RegistryEntry> = Object.fromEntries(
  MOLDURA_VARIANTE_TIPOS.map((variante) => [
    chaveRegistry(variante),
    {
      label: `Moldura ${MOLDURAS_CATALOGO[variante].label}`,
      icone: Frame,
      imagemPreview: MOLDURAS_CATALOGO[variante].src,
      criarComponentePadrao: (x: number, y: number) => ({
        id: gerarId(), tipo: "moldura", x, y, w: LARGURA_PADRAO, h: ALTURA_PADRAO, zIndex: 0, rotacao: 0,
        variante,
      }),
    } satisfies RegistryEntry,
  ]),
) as Record<ChaveMoldura, RegistryEntry>;

/** Mesmo padrão de `registryFormaParaEstilo` — "moldura" não existe como chave própria de
 * `COMPONENTES_REGISTRY` (só as 20 chaves prefixadas existem), quem precisa da entrada de
 * registry a partir de um `ComponenteSlide` já montado resolve por aqui, via `variante`. */
export function registryMolduraParaEstilo(variante: MolduraVarianteTipo): RegistryEntry {
  return REGISTRY_MOLDURAS[chaveRegistry(variante)];
}
