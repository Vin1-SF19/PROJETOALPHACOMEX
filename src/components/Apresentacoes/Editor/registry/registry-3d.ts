import { Globe, Orbit, Box } from "lucide-react";
import type { RegistryEntry } from "./registry-tipos";
import { gerarId } from "./registry-tipos";

export const REGISTRY_3D: Record<"globo" | "particulas" | "objeto3d", RegistryEntry> = {
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
};
