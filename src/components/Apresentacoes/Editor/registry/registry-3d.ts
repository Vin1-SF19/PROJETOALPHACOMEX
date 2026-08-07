import { Globe, Orbit, Box, Container as ContainerIcon } from "lucide-react";
import type { RegistryEntry } from "./registry-tipos";
import { gerarId } from "./registry-tipos";
import { CANVAS_PADRAO } from "@/lib/apresentacoes/canvas";

export const REGISTRY_3D: Record<"globo" | "particulas" | "objeto3d" | "containerCarga", RegistryEntry> = {
  globo: {
    label: "Globo",
    icone: Globe,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "globo", x, y, w: 300, h: 300, zIndex: 0, rotacao: 0,
      velocidadeRotacao: 0.5, marcadores: [], rotas: [],
    }),
  },
  particulas: {
    label: "Partículas",
    icone: Orbit,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "particulas", x, y, w: 400, h: 300, zIndex: 0, rotacao: 0,
      quantidade: 300, cor: "#818cf8", tamanho: 2, velocidade: 1,
    }),
  },
  objeto3d: {
    label: "Objeto 3D",
    icone: Box,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "objeto3d", x, y, w: 300, h: 300, zIndex: 0, rotacao: 0,
      url: "", autoRotacao: true, escala: 1,
    }),
  },
  containerCarga: {
    label: "Container Alpha",
    icone: ContainerIcon,
    // Nasce em tamanho padrão de slide (não mais 640x360) — é uma capa de tela cheia,
    // não um elemento decorativo pequeno; ApresentacaoEditor.tsx ajusta pro canvas real ao soltar.
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "containerCarga", x, y, w: CANVAS_PADRAO.width, h: CANVAS_PADRAO.height, zIndex: 0, rotacao: 0,
      corPrincipal: "#071a3d", corMetal: "#96a3b2", corInterior: "#171b22",
      anguloAbertura: 105, duracaoAbertura: 1.8, atrasoAbertura: 0.2,
      transicaoProximoSlide: true, duracaoZoom: 1.4,
      somHabilitado: false, somAbertura: "industrial", volumeSom: 0.65,
      mostrarLogo: true, estadoEditor: "aberto",
    }),
  },
};
