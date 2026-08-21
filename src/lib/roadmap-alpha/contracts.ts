import { z } from "zod";

import { developmentProviderSchema } from "@/lib/roadmap-production/contracts";

export const ROADMAP_CONTRACT_VERSION = 1 as const;
export const ROADMAP_PHASE_KINDS = [
  "CONTEXT",
  "EXECUTION",
  "VERIFICATION",
  "CLOSURE",
] as const;
export const ROADMAP_PHASE_AGENTS = [
  "context",
  "scout",
  "vault",
  "iris",
  "echo",
  "nova",
  "cortex",
  "anubis",
  "forge",
  "probe",
  "lens",
  "sage",
  "scribe",
  "kowalski",
  "dev",
] as const;

const roadmapSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug deve conter somente letras minúsculas, números e hífens",
  );

/**
 * `moduleKey` NÃO é validado contra MODULOS_REGISTRY aqui — esse array é
 * estático e conhecido só no import do módulo, mas moduleKey também pode vir
 * de um RoadmapWorkspace (tabela dinâmica). A validação real acontece de
 * forma assíncrona nas Server Actions (ver isValidRoadmapModuleKey em
 * catalog.ts), DEPOIS deste parse — nunca confiar só na forma da string.
 */
export const roadmapObjectiveInputSchema = z
  .object({
    contractVersion: z.literal(ROADMAP_CONTRACT_VERSION),
    moduleKey: z.string().trim().min(1).max(80),
    title: z.string().trim().min(3).max(180),
    description: z.string().trim().min(10).max(10_000),
    desiredOutcome: z.string().trim().max(4_000).optional(),
    constraints: z.string().trim().max(8_000).optional(),
    acceptanceCriteria: z
      .array(z.string().trim().min(3).max(500))
      .min(1)
      .max(50),
    globalPriority: z.number().int().min(1).max(9_999),
  })
  .strict();

export const roadmapObjectiveCreateSchema = roadmapObjectiveInputSchema.extend({
  developmentProvider: developmentProviderSchema.default("claude"),
});

export const roadmapObjectiveContentSchema = roadmapObjectiveInputSchema.omit({
  globalPriority: true,
});

export const roadmapObjectiveEditSchema = roadmapObjectiveContentSchema.extend({
  developmentProvider: developmentProviderSchema,
});

const dependsOnSchema = z
  .array(z.number().int().min(0).max(99))
  .max(10)
  .default([])
  .superRefine((values, ctx) => {
    if (new Set(values).size !== values.length) {
      ctx.addIssue({
        code: "custom",
        message: "Dependências não podem se repetir",
      });
    }
  });

export const roadmapPromptPhaseSchema = z
  .object({
    number: z.number().int().min(0).max(99),
    slug: roadmapSlugSchema,
    title: z.string().trim().min(3).max(140),
    kind: z.enum(ROADMAP_PHASE_KINDS),
    agent: z.enum(ROADMAP_PHASE_AGENTS),
    dependsOn: dependsOnSchema,
    markdown: z.string().trim().min(100).max(50_000),
  })
  .strict();

export const roadmapPhaseManifestSchema = z
  .object({
    contractVersion: z.literal(ROADMAP_CONTRACT_VERSION),
    summary: z.string().trim().min(20).max(2_000),
    phases: z.array(roadmapPromptPhaseSchema).min(2).max(24),
  })
  .strict()
  .superRefine((manifest, ctx) => {
    let totalMarkdownCharacters = 0;
    let hasExecution = false;

    manifest.phases.forEach((phase, index) => {
      totalMarkdownCharacters += phase.markdown.length;
      hasExecution ||= phase.kind === "EXECUTION";
      if (phase.number !== index) {
        ctx.addIssue({
          code: "custom",
          path: ["phases", index, "number"],
          message: `Numeração descontínua; esperado ${index}`,
        });
      }
      phase.dependsOn.forEach((dependency, dependencyIndex) => {
        if (dependency >= phase.number) {
          ctx.addIssue({
            code: "custom",
            path: ["phases", index, "dependsOn", dependencyIndex],
            message: "Dependência deve apontar para uma fase anterior",
          });
        }
      });
    });

    const context = manifest.phases[0];
    if (
      context &&
      (context.kind !== "CONTEXT" || context.agent !== "context")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["phases", 0],
        message: "A fase 0 deve ser CONTEXT/context",
      });
    }
    if (!hasExecution)
      ctx.addIssue({
        code: "custom",
        path: ["phases"],
        message: "Inclua ao menos uma fase EXECUTION",
      });
    if (totalMarkdownCharacters > 1_000_000) {
      ctx.addIssue({
        code: "custom",
        path: ["phases"],
        message: "Manifesto excede o limite total de Markdown",
      });
    }
  });

export type RoadmapObjectiveInput = z.infer<typeof roadmapObjectiveInputSchema>;
export type RoadmapObjectiveCreate = z.infer<
  typeof roadmapObjectiveCreateSchema
>;
export type RoadmapObjectiveContent = z.infer<
  typeof roadmapObjectiveContentSchema
>;
export type RoadmapObjectiveEdit = z.infer<typeof roadmapObjectiveEditSchema>;
export type RoadmapPromptPhase = z.infer<typeof roadmapPromptPhaseSchema>;
export type RoadmapPhaseManifest = z.infer<typeof roadmapPhaseManifestSchema>;

export function roadmapPhaseFilename(
  phase: Pick<RoadmapPromptPhase, "number" | "slug">,
): string {
  const parsed = roadmapPromptPhaseSchema
    .pick({ number: true, slug: true })
    .parse({
      number: phase.number,
      slug: phase.slug,
    });
  return `${String(parsed.number).padStart(2, "0")}-${parsed.slug}.md`;
}
