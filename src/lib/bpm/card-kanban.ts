import { z } from "zod";

/**
 * Registry da composição configurável do card FECHADO do Kanban (RM-2026-E1E1F7).
 * Independente do formulário do card aberto (`formularios-etapa.ts`): aqui só
 * existem elementos compactos exibidos no card do board. Elementos nativos usam
 * chave estável; campos comerciais usam `campoId` — nunca nome/rótulo, que é
 * só apresentação e pode mudar sem quebrar a composição persistida.
 */
export const CARD_KANBAN_NATIVE_REGISTRY = {
  EMPRESA_NOME: {
    label: "Nome da empresa",
    description: "Razão social ou nome fantasia da empresa do card.",
  },
  CNPJ: {
    label: "CNPJ",
    description: "CNPJ da empresa do card, quando cadastrado.",
  },
  NOME_FANTASIA: { label: "Nome fantasia", description: "Nome fantasia cadastrado da empresa." },
  SERVICO: { label: "Serviço", description: "Serviço vinculado ao card." },
  STATUS_POS_FECHAMENTO: { label: "Status pós-fechamento", description: "Status comercial visível na etapa." },
  PROXIMO_CONTATO: { label: "Próximo contato", description: "Data e hora do próximo contato." },
  PROXIMA_TAREFA: { label: "Próxima tarefa", description: "Próximo prazo de tarefa pendente." },
  ANOTACAO_RAPIDA: { label: "Anotação rápida", description: "Lembrete rápido pendente." },
  TAREFAS: { label: "Quantidade de tarefas", description: "Total de tarefas do card." },
  ANEXOS: { label: "Quantidade de anexos", description: "Total de anexos do card." },
  TELEFONE: {
    label: "Telefone",
    description: "Telefone real das pessoas vinculadas à empresa (ou do lead virtual).",
  },
  CHECKLIST: {
    label: "Progresso do procedimento",
    description: "Itens concluídos sobre o total dos procedimentos aplicáveis ao card.",
  },
  CADENCIA: {
    label: "Próxima execução da cadência",
    description: "Data/hora da próxima execução de cadência vigente para o card.",
  },
  PENDENCIAS: {
    label: "Pendências obrigatórias",
    description: "Quantidade de pendências obrigatórias em aberto para avançar o card.",
  },
  AGENDAMENTO_REUNIAO: {
    label: "Agendamento de reunião (data/hora + Google Meet)",
    description: "Widget de data/hora da reunião e botão de Google Meet — substitui o corpo padrão do card quando ativo.",
  },
} as const;

export type CardKanbanNativeKey = keyof typeof CARD_KANBAN_NATIVE_REGISTRY;

export const CARD_KANBAN_NATIVE_KEYS = Object.keys(
  CARD_KANBAN_NATIVE_REGISTRY,
) as CardKanbanNativeKey[];

/**
 * Elementos que não são um badge de texto simples — têm apresentação própria
 * e são renderizados pelo consumidor (PipelineBoardClient), não pelo
 * CardKanbanRenderer genérico. Ainda assim fazem parte da composição
 * persistida e do catálogo do editor, para não ficarem hardcoded por etapa.
 */
export const CARD_KANBAN_NATIVE_ESTRUTURAIS: readonly CardKanbanNativeKey[] = [
  "AGENDAMENTO_REUNIAO",
];

const cardKanbanNativeKeySchema = z.enum(
  CARD_KANBAN_NATIVE_KEYS as [CardKanbanNativeKey, ...CardKanbanNativeKey[]],
);

export const cardKanbanElementoSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("NATIVE"), key: cardKanbanNativeKeySchema }).strict(),
    z
      .object({ kind: z.literal("CAMPO"), campoId: z.string().trim().min(1).max(200) })
      .strict(),
  ]);

export type CardKanbanElemento = z.infer<typeof cardKanbanElementoSchema>;

/** Lista persistida: ordem importa, sem duplicidade de identidade estável. */
export const cardKanbanComposicaoSchema = z
  .array(cardKanbanElementoSchema)
  .max(20)
  .superRefine((elementos, context) => {
    const chaves = elementos.map((elemento) =>
      elemento.kind === "NATIVE" ? `NATIVE:${elemento.key}` : `CAMPO:${elemento.campoId}`,
    );
    if (new Set(chaves).size !== chaves.length) {
      context.addIssue({
        code: "custom",
        message: "Cada elemento só pode aparecer uma vez na composição.",
      });
    }
  });

export type CardKanbanComposicao = z.infer<typeof cardKanbanComposicaoSchema>;

export function elementoCardKanbanChaveEstavel(elemento: CardKanbanElemento): string {
  return elemento.kind === "NATIVE" ? `native:${elemento.key}` : `campo:${elemento.campoId}`;
}

export function serializarComposicaoCardKanban(composicao: CardKanbanComposicao): string {
  return JSON.stringify(composicao);
}

/** Ausência de registro (`null`) é distinta de composição vazia (`[]`) — AC-06. */
export function desserializarComposicaoCardKanban(
  camposJson: string | null | undefined,
): CardKanbanComposicao | null {
  if (camposJson === null || camposJson === undefined) return null;
  try {
    const parsed: unknown = JSON.parse(camposJson);
    const resultado = cardKanbanComposicaoSchema.safeParse(parsed);
    return resultado.success ? resultado.data : [];
  } catch {
    return [];
  }
}

export function composicaoCardKanbanSemAlteracao(
  anterior: CardKanbanComposicao,
  recebida: CardKanbanComposicao,
): boolean {
  if (anterior.length !== recebida.length) return false;
  return anterior.every((elemento, indice) => {
    const outro = recebida[indice];
    if (!outro || elemento.kind !== outro.kind) return false;
    return elemento.kind === "NATIVE" && outro.kind === "NATIVE"
      ? elemento.key === outro.key
      : elemento.kind === "CAMPO" && outro.kind === "CAMPO"
        ? elemento.campoId === outro.campoId
        : false;
  });
}
