import { Rocket, Radar, Star, Moon, Clock, Grid3x3, Waves } from "lucide-react";
import type { RegistryEntry } from "./registry-tipos";
import { gerarId } from "./registry-tipos";
import { CANVAS_PADRAO } from "@/lib/apresentacoes/canvas";
import type { FundoAnimadoComponente } from "@/lib/validations/slide-componentes";

/**
 * Categoria "Backgrounds" — fundos animados de tela cheia. Um único tipo (`fundoAnimado`,
 * ver slide-componentes-fundos.ts) com `estilo` interno; os 3 itens "estelar" só diferem no
 * preset inicial (cor/densidade/relógio), evitando triplicar a engine (decisão do usuário).
 * Nasce sempre no tamanho do canvas padrão — o Editor (ApresentacaoEditor.tsx/handleDragEnd)
 * ajusta para o tamanho real do canvas ativo e força o zIndex mais baixo da lista ao soltar.
 */
export const REGISTRY_FUNDOS: Record<
  "fundoCosmosIAlpha" | "fundoRadar" | "fundoEstelarCsNps" | "fundoEstelarChecklist" | "fundoEstelarAgendaAlpha" | "fundoBlueprint" | "fundoAurora",
  RegistryEntry
> = {
  fundoCosmosIAlpha: {
    label: "Cosmos IAlpha",
    icone: Rocket,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "fundoAnimado", x, y, w: CANVAS_PADRAO.width, h: CANVAS_PADRAO.height, zIndex: 0, rotacao: 0,
      estilo: "cosmosIAlpha",
      corPrimaria: "#4f46e5", corSecundaria: "#0ea5e9",
      velocidade: 1, densidade: 1, direcao: "horario", intensidade: 1,
      mostrarSol: true, quantidadePlanetas: 8, mostrarGrade: true, mostrarRelogio: false,
    }),
  },
  fundoRadar: {
    label: "Radar Sonar",
    icone: Radar,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "fundoAnimado", x, y, w: CANVAS_PADRAO.width, h: CANVAS_PADRAO.height, zIndex: 0, rotacao: 0,
      estilo: "radar",
      corPrimaria: "#4f46e5", corSecundaria: "#0ea5e9",
      velocidade: 1, densidade: 1, direcao: "horario", intensidade: 1,
      mostrarSol: true, quantidadePlanetas: 8, mostrarGrade: true, mostrarRelogio: false,
    }),
  },
  fundoEstelarCsNps: {
    label: "Estelar CS & NPS",
    icone: Star,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "fundoAnimado", x, y, w: CANVAS_PADRAO.width, h: CANVAS_PADRAO.height, zIndex: 0, rotacao: 0,
      estilo: "estelar", preset: "csNps",
      corPrimaria: "#4f46e5", corSecundaria: "#0ea5e9",
      velocidade: 1, densidade: 1, direcao: "horario", intensidade: 1,
      mostrarSol: true, quantidadePlanetas: 8, mostrarGrade: true, mostrarRelogio: false,
    }),
  },
  fundoEstelarChecklist: {
    label: "Estelar CheckList",
    icone: Moon,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "fundoAnimado", x, y, w: CANVAS_PADRAO.width, h: CANVAS_PADRAO.height, zIndex: 0, rotacao: 0,
      estilo: "estelar", preset: "checklist",
      // Identidade própria (esmeralda "concluído", mais calmo e denso) — evita ser um quase-clone do CS & NPS.
      corPrimaria: "#10b981", corSecundaria: "#6366f1",
      velocidade: 0.8, densidade: 1.3, direcao: "horario", intensidade: 1,
      mostrarSol: true, quantidadePlanetas: 8, mostrarGrade: true, mostrarRelogio: false,
    }),
  },
  fundoEstelarAgendaAlpha: {
    label: "Estelar Agenda Alpha",
    icone: Clock,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "fundoAnimado", x, y, w: CANVAS_PADRAO.width, h: CANVAS_PADRAO.height, zIndex: 0, rotacao: 0,
      estilo: "estelar", preset: "agendaAlpha",
      corPrimaria: "#4f46e5", corSecundaria: "#f59e0b",
      velocidade: 1, densidade: 0.9, direcao: "horario", intensidade: 1,
      mostrarSol: true, quantidadePlanetas: 8, mostrarGrade: true, mostrarRelogio: true,
    }),
  },
  fundoBlueprint: {
    label: "Blueprint Técnico",
    icone: Grid3x3,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "fundoAnimado", x, y, w: CANVAS_PADRAO.width, h: CANVAS_PADRAO.height, zIndex: 0, rotacao: 0,
      estilo: "blueprintTecnico",
      corPrimaria: "#4f46e5", corSecundaria: "#0ea5e9",
      velocidade: 1, densidade: 1, direcao: "horario", intensidade: 1,
      mostrarSol: true, quantidadePlanetas: 8, mostrarGrade: true, mostrarRelogio: false,
    }),
  },
  fundoAurora: {
    label: "Aurora dos Módulos",
    icone: Waves,
    criarComponentePadrao: (x, y) => ({
      id: gerarId(), tipo: "fundoAnimado", x, y, w: CANVAS_PADRAO.width, h: CANVAS_PADRAO.height, zIndex: 0, rotacao: 0,
      estilo: "auroraModulos",
      corPrimaria: "#4338ca", corSecundaria: "#1e293b",
      velocidade: 1, densidade: 1, direcao: "horario", intensidade: 0.9,
      mostrarSol: true, quantidadePlanetas: 8, mostrarGrade: true, mostrarRelogio: false,
    }),
  },
};

/**
 * Resolve a entrada de registry (label/ícone) de uma INSTÂNCIA já existente no slide —
 * diferente de indexar `REGISTRY_FUNDOS[chave]` (que só faz sentido pra paleta). O `tipo`
 * sozinho ("fundoAnimado") não diferencia qual dos 7 fundos foi arrastado — isso vive em
 * `estilo`/`preset`. Usado pela Timeline para não rotular todo background como o mesmo item.
 */
export function registryFundoParaEstilo(
  estilo: FundoAnimadoComponente["estilo"],
  preset: FundoAnimadoComponente["preset"],
): RegistryEntry {
  switch (estilo) {
    case "cosmosIAlpha":
      return REGISTRY_FUNDOS.fundoCosmosIAlpha;
    case "radar":
      return REGISTRY_FUNDOS.fundoRadar;
    case "blueprintTecnico":
      return REGISTRY_FUNDOS.fundoBlueprint;
    case "auroraModulos":
      return REGISTRY_FUNDOS.fundoAurora;
    case "estelar":
      if (preset === "checklist") return REGISTRY_FUNDOS.fundoEstelarChecklist;
      if (preset === "agendaAlpha") return REGISTRY_FUNDOS.fundoEstelarAgendaAlpha;
      return REGISTRY_FUNDOS.fundoEstelarCsNps;
    default:
      return REGISTRY_FUNDOS.fundoCosmosIAlpha;
  }
}
