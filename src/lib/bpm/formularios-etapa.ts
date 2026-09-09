import { z } from "zod";

import { BPM_CAPABILITIES, parseBpmCapabilities } from "@/lib/bpm/ontology";

export const BPM_STAGE_CHECKLIST_TARGET = BPM_CAPABILITIES.STAGE_CHECKLIST;

export const BPM_FORM_CAPABILITIES = [
  BPM_CAPABILITIES.MEETING_SCHEDULER,
  BPM_CAPABILITIES.MEETING_TRANSCRIPT,
  BPM_CAPABILITIES.FOLLOW_UP_SCHEDULER,
  BPM_CAPABILITIES.FOLLOW_UP_CHECKLIST,
  BPM_CAPABILITIES.STANDBY_FOLLOW_UP,
  BPM_CAPABILITIES.COMMERCIAL_POST_CLOSING,
] as const;

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
        !BPM_FORM_CAPABILITIES.includes(
          componente.capability as (typeof BPM_FORM_CAPABILITIES)[number],
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
        JSON.parse(componente.configJson);
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
