import { Network, Triangle } from "lucide-react";
import type { RegistryEntry } from "./registry-tipos";
import { gerarId } from "./registry-tipos";

export const REGISTRY_BUSINESS: Record<"grafo" | "diagrama", RegistryEntry> = {
  grafo: {
    label: "Fluxograma",
    icone: Network,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "grafo", x, y, w: 560, h: 320, zIndex: 0, rotacao: 0,
      estilo: "fluxograma",
      nos: [
        { id: "n1", label: "Início", x: 40, y: 40 },
        { id: "n2", label: "Fim", x: 280, y: 160 },
      ],
      conexoes: [{ origem: "n1", destino: "n2" }],
    }),
  },
  diagrama: {
    label: "Diagrama SWOT",
    icone: Triangle,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "diagrama", x, y, w: 480, h: 320, zIndex: 0, rotacao: 0,
      formato: "swot",
      itens: [
        { label: "Forças", cor: "#22c55e" },
        { label: "Fraquezas", cor: "#ef4444" },
        { label: "Oportunidades", cor: "#3b82f6" },
        { label: "Ameaças", cor: "#f59e0b" },
      ],
    }),
  },
};
