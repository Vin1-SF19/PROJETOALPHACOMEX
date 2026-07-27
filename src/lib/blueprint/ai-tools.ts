import type { OllamaTool } from "@/lib/bibble/tools";

/**
 * Tools da IA do Alpha Blueprint. Isoladas das tools gerais do Bibble (`lib/bibble/tools.ts`)
 * de propósito — nunca devem ser expostas fora do chat contextual de um projeto específico,
 * e todo execution SEMPRE recebe `projectId` do servidor (nunca do modelo), garantindo que
 * a IA não possa ler/escrever em outro projeto que não seja o da conversa atual.
 */
export const BLUEPRINT_AI_TOOLS: OllamaTool[] = [
  {
    type: "function",
    function: {
      name: "resumir_projeto",
      description:
        "Lê todo o material já registrado no projeto (dados gerais, documento, requisitos, perguntas, comentários) e gera um resumo executivo organizado.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "identificar_lacunas",
      description:
        "Analisa o material do projeto e lista o que ainda está faltando ou mal explicado (usuários, fluxo, permissões, dados, integrações, critérios de aceite).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "gerar_requisitos_sugeridos",
      description:
        "Lê o documento de especificação e sugere uma lista de requisitos estruturados (não cria automaticamente — apenas retorna a sugestão para o usuário revisar e aceitar).",
      parameters: {
        type: "object",
        properties: {
          foco: { type: "string", description: "Área de foco opcional, ex: 'permissões' ou 'fluxo de cadastro'" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "gerar_perguntas_pendentes",
      description:
        "Sugere perguntas que deveriam ser respondidas pelo solicitante antes de considerar o projeto pronto para desenvolvimento.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

export function isBlueprintAiTool(nome: string): boolean {
  return BLUEPRINT_AI_TOOLS.some((t) => t.function.name === nome);
}
