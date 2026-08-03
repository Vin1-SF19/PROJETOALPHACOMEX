import { Type, Image as ImageIcon, Video, AudioLines, RectangleHorizontal, Square, LayoutGrid, PanelsTopLeft, Sparkles, Minus } from "lucide-react";
import type { RegistryEntry } from "./registry-tipos";
import { gerarId } from "./registry-tipos";

export const REGISTRY_BASICOS: Record<
  "texto" | "imagem" | "video" | "audio" | "botao" | "card" | "grid" | "container" | "icone" | "divisor",
  RegistryEntry
> = {
  texto: {
    label: "Texto",
    icone: Type,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "texto", x, y, w: 280, h: 60, zIndex: 0, rotacao: 0,
      texto: "Texto", tag: "p", alinhamento: "left",
    }),
  },
  imagem: {
    label: "Imagem",
    icone: ImageIcon,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "imagem", x, y, w: 320, h: 200, zIndex: 0, rotacao: 0,
      url: "", objectFit: "cover",
    }),
  },
  video: {
    label: "Vídeo",
    icone: Video,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "video", x, y, w: 480, h: 270, zIndex: 0, rotacao: 0,
      url: "", autoplay: false, loop: false, controles: true, muted: true,
    }),
  },
  audio: {
    label: "Áudio",
    icone: AudioLines,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "audio", x, y, w: 420, h: 72, zIndex: 0, rotacao: 0,
      url: "", titulo: "Áudio", autoplay: false, loop: false, controles: true,
    }),
  },
  botao: {
    label: "Botão",
    icone: RectangleHorizontal,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "botao", x, y, w: 160, h: 48, zIndex: 0, rotacao: 0,
      texto: "Botão", corFundo: "#4f46e5", corTexto: "#ffffff", borderRadius: 12,
    }),
  },
  card: {
    label: "Card",
    icone: Square,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "card", x, y, w: 360, h: 160, zIndex: 0, rotacao: 0,
      corFundo: "#0f172a", borderRadius: 16, padding: 16, filhos: [],
    }),
  },
  grid: {
    label: "Grid",
    icone: LayoutGrid,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "grid", x, y, w: 480, h: 160, zIndex: 0, rotacao: 0,
      colunas: 2, gap: 12, filhos: [],
    }),
  },
  container: {
    label: "Container",
    icone: PanelsTopLeft,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "container", x, y, w: 480, h: 240, zIndex: 0, rotacao: 0,
      layout: "flex-col", gap: 12, filhos: [],
    }),
  },
  icone: {
    label: "Ícone",
    icone: Sparkles,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "icone", x, y, w: 48, h: 48, zIndex: 0, rotacao: 0,
      nomeIcone: "Sparkles", cor: "#4f46e5", tamanhoIcone: 32,
    }),
  },
  divisor: {
    label: "Divisor",
    icone: Minus,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "divisor", x, y, w: 240, h: 2, zIndex: 0, rotacao: 0,
      cor: "#ffffff33", espessura: 2,
    }),
  },
};
