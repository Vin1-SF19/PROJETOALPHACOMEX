import { z } from "zod";

import { BPM_CAPABILITIES, parseBpmCapabilities } from "@/lib/bpm/ontology";

export const BPM_STAGE_CHECKLIST_TARGET = BPM_CAPABILITIES.STAGE_CHECKLIST;

const emptyConfigSchema = z.object({}).strict();
export const BPM_FORM_FIELD_CONFIG_SCHEMA = emptyConfigSchema;

/**
 * Registry único dos componentes especializados que podem ser persistidos no
 * formulário de etapa. Labels são metadados de apresentação; `target` é a
 * identidade estável usada por save, resolver, builder, preview e runtime.
 */
export const BPM_FORM_COMPONENT_REGISTRY = {
  [BPM_CAPABILITIES.STAGE_CHECKLIST]: {
    tipo: "CHECKLIST",
    target: BPM_CAPABILITIES.STAGE_CHECKLIST,
    label: "Checklists da etapa",
    description: "Checklists aplicáveis ao card na etapa atual.",
    rendererId: "stage-checklist",
    multiple: false,
    configSchema: emptyConfigSchema,
  },
  [BPM_CAPABILITIES.MEETING_SCHEDULER]: {
    tipo: "CAPABILITY",
    target: BPM_CAPABILITIES.MEETING_SCHEDULER,
    label: "Agendamento de reunião",
    description: "Agenda uma reunião com os contatos do card.",
    rendererId: "meeting-scheduler",
    multiple: false,
    configSchema: emptyConfigSchema,
  },
  [BPM_CAPABILITIES.MEETING_TRANSCRIPT]: {
    tipo: "CAPABILITY",
    target: BPM_CAPABILITIES.MEETING_TRANSCRIPT,
    label: "Transcrição da reunião",
    description: "Exibe e processa a transcrição vinculada ao card.",
    rendererId: "meeting-transcript",
    multiple: false,
    configSchema: emptyConfigSchema,
  },
  [BPM_CAPABILITIES.FOLLOW_UP_SCHEDULER]: {
    tipo: "CAPABILITY",
    target: BPM_CAPABILITIES.FOLLOW_UP_SCHEDULER,
    label: "Próximo contato",
    description: "Agenda o próximo contato do card.",
    rendererId: "follow-up-scheduler",
    multiple: false,
    configSchema: emptyConfigSchema,
  },
  [BPM_CAPABILITIES.FOLLOW_UP_CHECKLIST]: {
    tipo: "CAPABILITY",
    target: BPM_CAPABILITIES.FOLLOW_UP_CHECKLIST,
    label: "Checklist de follow-up",
    description: "Acompanha as ações de follow-up da etapa.",
    rendererId: "follow-up-checklist",
    multiple: false,
    configSchema: emptyConfigSchema,
  },
  [BPM_CAPABILITIES.STANDBY_FOLLOW_UP]: {
    tipo: "CAPABILITY",
    target: BPM_CAPABILITIES.STANDBY_FOLLOW_UP,
    label: "Follow-up de standby",
    description: "Gerencia o acompanhamento do card em standby.",
    rendererId: "standby-follow-up",
    multiple: false,
    configSchema: emptyConfigSchema,
  },
  [BPM_CAPABILITIES.COMMERCIAL_POST_CLOSING]: {
    tipo: "CAPABILITY",
    target: BPM_CAPABILITIES.COMMERCIAL_POST_CLOSING,
    label: "Pós-fechamento comercial",
    description: "Registra o estado operacional após o fechamento.",
    rendererId: "commercial-post-closing",
    multiple: false,
    configSchema: emptyConfigSchema,
  },
} as const;

/** Elementos reais do card que são estruturais e não variam por etapa. */
export const BPM_CARD_SHELL_REGISTRY = {
  TASKS: { rendererId: "card-tasks", label: "Tarefas", configurable: false },
  ATTACHMENTS: { rendererId: "card-attachments", label: "Anexos", configurable: false },
  HISTORY: { rendererId: "card-history", label: "Histórico", configurable: false },
  TIMELINE: { rendererId: "card-timeline", label: "Timeline", configurable: false },
  CADENCES: { rendererId: "card-cadences", label: "Cadências", configurable: false },
  SLA: { rendererId: "card-sla", label: "SLA", configurable: false },
  STAGE_NAVIGATION: { rendererId: "stage-navigation", label: "Próxima etapa", configurable: false },
  SCRIPTS: { rendererId: "stage-scripts", label: "Scripts", configurable: false },
} as const;

export type BpmFormComponentTarget = keyof typeof BPM_FORM_COMPONENT_REGISTRY;

export const BPM_FORM_CAPABILITIES = Object.values(
  BPM_FORM_COMPONENT_REGISTRY,
)
  .filter((item) => item.tipo === "CAPABILITY")
  .map((item) => item.target) as Array<Exclude<BpmFormComponentTarget, typeof BPM_STAGE_CHECKLIST_TARGET>>;

export function obterDefinicaoComponenteFormulario(target: string | null | undefined) {
  if (!target) return null;
  return BPM_FORM_COMPONENT_REGISTRY[target as BpmFormComponentTarget] ?? null;
}

export function listarCatalogoComponentesFormulario(capabilitiesJson?: string | null) {
  const permitidas = parseBpmCapabilities(capabilitiesJson);
  return Object.values(BPM_FORM_COMPONENT_REGISTRY)
    .filter((item) => item.tipo === "CHECKLIST" || permitidas.has(item.target))
    .map((item) => ({
      tipo: item.tipo,
      target: item.target,
      label: item.label,
      description: item.description,
      rendererId: item.rendererId,
      multiple: item.multiple,
    }));
}

const persistedIdSchema = z.string().trim().min(1).max(200);

const componenteFormularioSchema = z
  .object({
    id: persistedIdSchema.optional(),
    chave: z.string().trim().min(1).max(100),
    tipo: z.enum(["CAMPO", "CHECKLIST", "CAPABILITY"]),
    campoId: persistedIdSchema.nullable(),
    capability: z.string().trim().min(1).max(100).nullable(),
    configJson: z.string().trim().max(20_000).nullable(),
  })
  .strict()
  .superRefine((componente, context) => {
    if (componente.tipo === "CAMPO") {
      if (!componente.campoId) {
        context.addIssue({
          code: "custom",
          path: ["campoId"],
          message: "Componente CAMPO exige campoId.",
        });
      }
      if (componente.capability) {
        context.addIssue({
          code: "custom",
          path: ["capability"],
          message: "Componente CAMPO não aceita capability.",
        });
      }
    }

    if (componente.tipo === "CHECKLIST") {
      if (componente.campoId) {
        context.addIssue({
          code: "custom",
          path: ["campoId"],
          message: "Componente CHECKLIST não aceita campoId.",
        });
      }
      if (componente.capability !== BPM_STAGE_CHECKLIST_TARGET) {
        context.addIssue({
          code: "custom",
          path: ["capability"],
          message: `Componente CHECKLIST exige o target ${BPM_STAGE_CHECKLIST_TARGET}.`,
        });
      }
    }

    if (componente.tipo === "CAPABILITY") {
      if (componente.campoId) {
        context.addIssue({
          code: "custom",
          path: ["campoId"],
          message: "Componente CAPABILITY não aceita campoId.",
        });
      }
      if (
        !componente.capability ||
        !BPM_FORM_CAPABILITIES.some(
          (capability) => capability === componente.capability,
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["capability"],
          message: "Capability inexistente ou não permitida.",
        });
      }
    }

    if (componente.configJson) {
      try {
        const config: unknown = JSON.parse(componente.configJson);
        const definicao = obterDefinicaoComponenteFormulario(componente.capability);
        const configSchema = componente.tipo === "CAMPO"
          ? BPM_FORM_FIELD_CONFIG_SCHEMA
          : definicao?.configSchema;
        if (configSchema && !configSchema.safeParse(config).success) {
          context.addIssue({
            code: "custom",
            path: ["configJson"],
            message: "configJson não atende ao schema do componente.",
          });
        }
      } catch {
        context.addIssue({
          code: "custom",
          path: ["configJson"],
          message: "configJson deve conter JSON válido.",
        });
      }
    }
  });

export const salvarFormularioEtapaSchema = z
  .object({
    pipelineId: persistedIdSchema,
    etapaId: persistedIdSchema,
    versaoEsperada: z.number().int().positive().nullable(),
    ativo: z.boolean(),
    secoes: z
      .array(
        z
          .object({
            id: persistedIdSchema.optional(),
            chave: z.string().trim().min(1).max(100),
            titulo: z.string().trim().min(1).max(120),
            componentes: z.array(componenteFormularioSchema).max(100),
          })
          .strict(),
      )
      .max(30),
  })
  .strict()
  .superRefine((formulario, context) => {
    const chavesSecao = formulario.secoes.map((secao) => secao.chave);
    if (new Set(chavesSecao).size !== chavesSecao.length) {
      context.addIssue({
        code: "custom",
        path: ["secoes"],
        message: "As chaves das seções devem ser únicas.",
      });
    }

    const idsSecao = formulario.secoes.flatMap((secao) =>
      secao.id ? [secao.id] : [],
    );
    if (new Set(idsSecao).size !== idsSecao.length) {
      context.addIssue({
        code: "custom",
        path: ["secoes"],
        message: "Uma seção persistida não pode aparecer duas vezes.",
      });
    }

    const componentes = formulario.secoes.flatMap(
      (secao) => secao.componentes,
    );
    const idsComponente = componentes.flatMap((componente) =>
      componente.id ? [componente.id] : [],
    );
    if (new Set(idsComponente).size !== idsComponente.length) {
      context.addIssue({
        code: "custom",
        path: ["secoes"],
        message: "Um componente persistido não pode aparecer duas vezes.",
      });
    }

    const campos = componentes.flatMap((componente) =>
      componente.tipo === "CAMPO" && componente.campoId
        ? [componente.campoId]
        : [],
    );
    if (new Set(campos).size !== campos.length) {
      context.addIssue({
        code: "custom",
        path: ["secoes"],
        message: "O mesmo campo não pode aparecer duas vezes no formulário.",
      });
    }

    for (const definicao of Object.values(BPM_FORM_COMPONENT_REGISTRY)) {
      if (definicao.multiple) continue;
      const ocorrencias = componentes.filter(
        (componente) => componente.capability === definicao.target,
      ).length;
      if (ocorrencias > 1) {
        context.addIssue({
          code: "custom",
          path: ["secoes"],
          message: `O componente ${definicao.target} não pode aparecer mais de uma vez no formulário.`,
        });
      }
    }

    formulario.secoes.forEach((secao, indice) => {
      const chaves = secao.componentes.map((componente) => componente.chave);
      if (new Set(chaves).size !== chaves.length) {
        context.addIssue({
          code: "custom",
          path: ["secoes", indice, "componentes"],
          message: "As chaves dos componentes devem ser únicas na seção.",
        });
      }
    });
  });

export type SalvarFormularioEtapaInput = z.infer<
  typeof salvarFormularioEtapaSchema
>;

export type ComponenteFormularioEtapa =
  SalvarFormularioEtapaInput["secoes"][number]["componentes"][number];

export function listarCapabilitiesInvalidasParaEtapa(
  componentes: readonly ComponenteFormularioEtapa[],
  capabilitiesJson: string | null | undefined,
): string[] {
  const permitidasNaEtapa = parseBpmCapabilities(capabilitiesJson);
  return [
    ...new Set(
      componentes.flatMap((componente) => {
        if (
          componente.tipo !== "CAPABILITY" ||
          !componente.capability ||
          permitidasNaEtapa.has(componente.capability)
        ) {
          return [];
        }
        return [componente.capability];
      }),
    ),
  ].sort();
}

type PersistedFormulario = {
  ativo: boolean;
  secoes: Array<{
    id: string;
    chave: string;
    titulo: string;
    ordem: number;
    componentes: Array<{
      id: string;
      chave: string;
      tipo: string;
      campoId: string | null;
      capability: string | null;
      configJson: string | null;
      ordem: number;
    }>;
  }>;
};

export function formularioEtapaSemAlteracao(
  persistido: PersistedFormulario,
  recebido: Pick<SalvarFormularioEtapaInput, "ativo" | "secoes">,
): boolean {
  if (persistido.ativo !== recebido.ativo) return false;
  if (persistido.secoes.length !== recebido.secoes.length) return false;

  return recebido.secoes.every((secao, ordemSecao) => {
    const atual = persistido.secoes[ordemSecao];
    if (
      !atual ||
      !secao.id ||
      secao.id !== atual.id ||
      secao.chave !== atual.chave ||
      secao.titulo !== atual.titulo ||
      ordemSecao !== atual.ordem ||
      secao.componentes.length !== atual.componentes.length
    ) {
      return false;
    }

    return secao.componentes.every((componente, ordemComponente) => {
      const existente = atual.componentes[ordemComponente];
      return Boolean(
        existente &&
          componente.id &&
          componente.id === existente.id &&
          componente.chave === existente.chave &&
          componente.tipo === existente.tipo &&
          componente.campoId === existente.campoId &&
          componente.capability === existente.capability &&
          componente.configJson === existente.configJson &&
          ordemComponente === existente.ordem,
      );
    });
  });
}
