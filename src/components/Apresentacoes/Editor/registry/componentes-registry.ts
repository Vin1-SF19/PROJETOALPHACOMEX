import {
  Type,
  Image as ImageIcon,
  RectangleHorizontal,
  Square,
  LayoutGrid,
  Sparkles,
  Minus,
  Globe,
  Orbit,
  Box,
  type LucideIcon,
} from "lucide-react";
import type { ComponenteSlide } from "@/lib/validations/slide-componentes";

export type TipoComponente = ComponenteSlide["tipo"];

/** Sem dependência nova: crypto.randomUUID() é nativo (browser e Node 19+). */
function gerarId(): string {
  return crypto.randomUUID();
}

interface RegistryEntry {
  label: string;
  icone: LucideIcon;
  criarComponentePadrao: (x: number, y: number) => ComponenteSlide;
}

const DEFAULT_W = 240;
const DEFAULT_H = 80;

export const COMPONENTES_REGISTRY: Record<TipoComponente, RegistryEntry> = {
  texto: {
    label: "Texto",
    icone: Type,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(),
      tipo: "texto",
      x,
      y,
      w: 280,
      h: 60,
      zIndex: 0,
      rotacao: 0,
      texto: "Texto",
      tag: "p",
      alinhamento: "left",
    }),
  },
  imagem: {
    label: "Imagem",
    icone: ImageIcon,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(),
      tipo: "imagem",
      x,
      y,
      w: 320,
      h: 200,
      zIndex: 0,
      rotacao: 0,
      url: "",
      objectFit: "cover",
    }),
  },
  botao: {
    label: "Botão",
    icone: RectangleHorizontal,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(),
      tipo: "botao",
      x,
      y,
      w: 160,
      h: 48,
      zIndex: 0,
      rotacao: 0,
      texto: "Botão",
      corFundo: "#4f46e5",
      corTexto: "#ffffff",
      borderRadius: 12,
    }),
  },
  card: {
    label: "Card",
    icone: Square,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(),
      tipo: "card",
      x,
      y,
      w: DEFAULT_W * 1.5,
      h: DEFAULT_H * 2,
      zIndex: 0,
      rotacao: 0,
      corFundo: "#0f172a",
      borderRadius: 16,
      padding: 16,
      filhos: [],
    }),
  },
  grid: {
    label: "Grid",
    icone: LayoutGrid,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(),
      tipo: "grid",
      x,
      y,
      w: DEFAULT_W * 2,
      h: DEFAULT_H * 2,
      zIndex: 0,
      rotacao: 0,
      colunas: 2,
      gap: 12,
      filhos: [],
    }),
  },
  icone: {
    label: "Ícone",
    icone: Sparkles,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(),
      tipo: "icone",
      x,
      y,
      w: 48,
      h: 48,
      zIndex: 0,
      rotacao: 0,
      nomeIcone: "Sparkles",
      cor: "#4f46e5",
      tamanhoIcone: 32,
    }),
  },
  divisor: {
    label: "Divisor",
    icone: Minus,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(),
      tipo: "divisor",
      x,
      y,
      w: 240,
      h: 2,
      zIndex: 0,
      rotacao: 0,
      cor: "#ffffff33",
      espessura: 2,
    }),
  },
  globo: {
    label: "Globo",
    icone: Globe,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(),
      tipo: "globo",
      x,
      y,
      w: 300,
      h: 300,
      zIndex: 0,
      rotacao: 0,
      velocidadeRotacao: 0.5,
      marcadores: [],
    }),
  },
  particulas: {
    label: "Partículas",
    icone: Orbit,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(),
      tipo: "particulas",
      x,
      y,
      w: 400,
      h: 300,
      zIndex: 0,
      rotacao: 0,
      quantidade: 300,
      cor: "#818cf8",
      tamanho: 2,
      velocidade: 1,
    }),
  },
  objeto3d: {
    label: "Objeto 3D",
    icone: Box,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(),
      tipo: "objeto3d",
      x,
      y,
      w: 300,
      h: 300,
      zIndex: 0,
      rotacao: 0,
      url: "",
      autoRotacao: true,
      escala: 1,
    }),
  },
};

export const TIPOS_COMPONENTE: TipoComponente[] = Object.keys(COMPONENTES_REGISTRY) as TipoComponente[];
