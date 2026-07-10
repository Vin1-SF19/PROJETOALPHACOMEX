import { ChartBar, Table2, Gauge, Rows3, Milestone, Columns3, MessageSquare, SquareCheck } from "lucide-react";
import type { RegistryEntry } from "./registry-tipos";
import { gerarId } from "./registry-tipos";

export const REGISTRY_DADOS: Record<
  "grafico" | "tabela" | "kpi" | "progresso" | "roadmap" | "comparacao" | "faq" | "checklist",
  RegistryEntry
> = {
  grafico: {
    label: "Gráfico",
    icone: ChartBar,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "grafico", x, y, w: 480, h: 300, zIndex: 0, rotacao: 0,
      tipoGrafico: "barra",
      dados: [{ label: "Jan", valor: 10 }, { label: "Fev", valor: 25 }, { label: "Mar", valor: 18 }],
    }),
  },
  tabela: {
    label: "Tabela",
    icone: Table2,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "tabela", x, y, w: 480, h: 240, zIndex: 0, rotacao: 0,
      colunas: ["Coluna 1", "Coluna 2"],
      linhas: [["Valor A", "Valor B"]],
    }),
  },
  kpi: {
    label: "KPI",
    icone: Gauge,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "kpi", x, y, w: 240, h: 120, zIndex: 0, rotacao: 0,
      valor: "42%", label: "Crescimento",
    }),
  },
  progresso: {
    label: "Progresso",
    icone: Rows3,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "progresso", x, y, w: 360, h: 40, zIndex: 0, rotacao: 0,
      percentual: 60, label: "Progresso",
    }),
  },
  roadmap: {
    label: "Roadmap",
    icone: Milestone,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "roadmap", x, y, w: 640, h: 160, zIndex: 0, rotacao: 0,
      itens: [{ titulo: "Etapa 1", concluido: true }, { titulo: "Etapa 2", concluido: false }],
      orientacao: "horizontal",
    }),
  },
  comparacao: {
    label: "Comparação",
    icone: Columns3,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "comparacao", x, y, w: 480, h: 320, zIndex: 0, rotacao: 0,
      colunas: [
        { titulo: "Plano Básico", itens: ["Recurso A"], destaque: false },
        { titulo: "Plano Pro", itens: ["Recurso A", "Recurso B"], destaque: true },
      ],
    }),
  },
  faq: {
    label: "FAQ",
    icone: MessageSquare,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "faq", x, y, w: 480, h: 240, zIndex: 0, rotacao: 0,
      itens: [{ pergunta: "Pergunta?", resposta: "Resposta." }],
    }),
  },
  checklist: {
    label: "Checklist",
    icone: SquareCheck,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "checklist", x, y, w: 320, h: 160, zIndex: 0, rotacao: 0,
      itens: [{ texto: "Item 1", concluido: false }],
    }),
  },
};
