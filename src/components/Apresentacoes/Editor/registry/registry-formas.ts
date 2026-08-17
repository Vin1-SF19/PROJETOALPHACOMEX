import {
  Square, Circle, Triangle, Diamond, Pentagon, Hexagon, Star, ArrowRight, ArrowLeft, ArrowUp,
  ArrowDown, ArrowLeftRight, ArrowUpDown, Heart, MessageCircle, MessageSquare, Plus, Moon, Zap,
  Cloud, Droplet, Shield, RectangleHorizontal, Settings, Sparkle, Ribbon, Tag, OctagonAlert, Circle as CircleAlt,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { RegistryEntry } from "./registry-tipos";
import { gerarId } from "./registry-tipos";
import type { FormaVarianteTipo } from "@/lib/validations/slide-componentes-basicos";
import { FORMAS_CATALOGO } from "@/lib/apresentacoes/formas-catalogo";

/** Ícone da sidebar por variante — reaproveita ícones próximos do lucide-react quando não há
 * correspondência 1:1 (ex. as 3 variantes de octógono usam o mesmo ícone de octógono). */
const ICONE_POR_VARIANTE: Record<FormaVarianteTipo, LucideIcon> = {
  retangulo: Square,
  retanguloArredondado: RectangleHorizontal,
  circulo: Circle,
  elipse: CircleAlt,
  triangulo: Triangle,
  trianguloInvertido: Triangle,
  losango: Diamond,
  pentagono: Pentagon,
  hexagono: Hexagon,
  heptagono: Hexagon,
  octogono: OctagonAlert,
  estrela4: Star,
  estrela5: Star,
  estrela6: Star,
  estrela8: Star,
  "seta-direita": ArrowRight,
  "seta-esquerda": ArrowLeft,
  "seta-cima": ArrowUp,
  "seta-baixo": ArrowDown,
  "setaDupla-horizontal": ArrowLeftRight,
  "setaDupla-vertical": ArrowUpDown,
  coracao: Heart,
  balaoFala: MessageCircle,
  balaoPensamento: MessageSquare,
  cruz: Plus,
  meiaLua: Moon,
  raio: Zap,
  nuvem: Cloud,
  gota: Droplet,
  escudo: Shield,
  hexagonoAlongado: Hexagon,
  paralelogramo: RectangleHorizontal,
  trapezio: RectangleHorizontal,
  pentagonoSeta: Pentagon,
  engrenagem: Settings,
  explosao: Sparkle,
  fitaHorizontal: Ribbon,
  placaSuspensa: Tag,
  octogonoStop: OctagonAlert,
  arco: Circle,
  anel: Circle,
};

const TAMANHO_PADRAO = 120;

export const REGISTRY_FORMAS: Record<FormaVarianteTipo, RegistryEntry> = Object.fromEntries(
  (Object.keys(FORMAS_CATALOGO) as FormaVarianteTipo[]).map((variante) => [
    variante,
    {
      label: FORMAS_CATALOGO[variante].label,
      icone: ICONE_POR_VARIANTE[variante],
      criarComponentePadrao: (x: number, y: number) => ({
        id: gerarId(), tipo: "forma", x, y, w: TAMANHO_PADRAO, h: TAMANHO_PADRAO, zIndex: 0, rotacao: 0,
        variante, corPreenchimento: "#4f46e5",
      }),
    } satisfies RegistryEntry,
  ]),
) as Record<FormaVarianteTipo, RegistryEntry>;

/** Mesmo padrão de `registryFundoParaEstilo` — "forma" não existe como chave própria de
 * `COMPONENTES_REGISTRY` (só as 40 variantes existem), então quem precisa da entrada de
 * registry a partir de um `ComponenteSlide` já montado (ex. Timeline mostrando ícone/label)
 * resolve por aqui, indexando por `variante` em vez de `tipo`. */
export function registryFormaParaEstilo(variante: FormaVarianteTipo): RegistryEntry {
  return REGISTRY_FORMAS[variante];
}
