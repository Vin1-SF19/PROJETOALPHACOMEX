import { Frame } from "lucide-react";
import type { RegistryEntry } from "./registry-tipos";
import { gerarId } from "./registry-tipos";
import { FORMA_VARIANTE_TIPOS, type FormaVarianteTipo } from "@/lib/validations/slide-componentes-basicos";
import { FORMAS_CATALOGO } from "@/lib/apresentacoes/formas-catalogo";

const LARGURA_PADRAO = 240;
const ALTURA_PADRAO = 240;

type ChaveMoldura = `moldura${Capitalize<FormaVarianteTipo>}`;

function chaveRegistry(contorno: FormaVarianteTipo): ChaveMoldura {
  return `moldura${contorno.charAt(0).toUpperCase()}${contorno.slice(1)}` as ChaveMoldura;
}

/** Chaves prefixadas com "moldura" (`molduraCirculo`, `molduraCoracao`...) — os contornos têm
 * nomes iguais aos de `REGISTRY_FORMAS` (`circulo`, `coracao`...) e as duas entram no mesmo
 * `COMPONENTES_REGISTRY` combinado, então precisam de chaves distintas para não colidir. Nasce
 * SEM imagem (só o contorno vazio, como no Canva) — usuário adiciona a foto depois pelo painel
 * de propriedades. Usa o ícone Lucide genérico `Frame` (não o ícone específico da forma, como em
 * `REGISTRY_FORMAS`) para deixar claro na sidebar que isso é um "slot de recorte", não a forma
 * preenchida em si. */
export const REGISTRY_MOLDURAS: Record<ChaveMoldura, RegistryEntry> = Object.fromEntries(
  FORMA_VARIANTE_TIPOS.map((contorno) => [
    chaveRegistry(contorno),
    {
      label: `Moldura ${FORMAS_CATALOGO[contorno].label}`,
      icone: Frame,
      criarComponentePadrao: (x: number, y: number) => ({
        id: gerarId(), tipo: "moldura", x, y, w: LARGURA_PADRAO, h: ALTURA_PADRAO, zIndex: 0, rotacao: 0,
        contorno,
      }),
    } satisfies RegistryEntry,
  ]),
) as Record<ChaveMoldura, RegistryEntry>;

/** Mesmo padrão de `registryFormaParaEstilo` — "moldura" não existe como chave própria de
 * `COMPONENTES_REGISTRY` (só as chaves prefixadas existem), quem precisa da entrada de registry
 * a partir de um `ComponenteSlide` já montado resolve por aqui, via `contorno`. */
export function registryMolduraParaEstilo(contorno: FormaVarianteTipo): RegistryEntry {
  return REGISTRY_MOLDURAS[chaveRegistry(contorno)];
}
