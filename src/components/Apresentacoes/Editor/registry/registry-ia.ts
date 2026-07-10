import { Bot } from "lucide-react";
import type { RegistryEntry } from "./registry-tipos";
import { gerarId } from "./registry-tipos";

export const REGISTRY_IA: Record<"chatIlustrativo", RegistryEntry> = {
  chatIlustrativo: {
    label: "Chat (ilustrativo)",
    icone: Bot,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "chatIlustrativo", x, y, w: 360, h: 280, zIndex: 0, rotacao: 0,
      mensagens: [
        { autor: "usuario", texto: "Como posso ajudar meu negócio a crescer?" },
        { autor: "ia", texto: "Vamos automatizar seus processos com IA." },
      ],
    }),
  },
};
