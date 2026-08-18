"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  listarAcessoModulo,
  toggleAcessoModulo,
} from "@/actions/PermissoesSetor";
import db from "@/lib/prisma";
import { requireRoadmapProductionAccess } from "@/lib/roadmap-alpha/authorization";
import { improveRoadmapField } from "@/lib/roadmap-alpha/improve-with-ai";
import { listBibbleAgents } from "@/lib/roadmap-production/agents";
import { productionProviderSchema } from "@/lib/roadmap-production/contracts";
import { diagnoseProductionProviders } from "@/lib/roadmap-production/providers";
import {
  enqueueProductionControl,
  readProductionConfig,
  readProductionState,
  writeProductionConfig,
} from "@/lib/roadmap-production/storage";
import { refreshProductionExecutions } from "@/lib/roadmap-production/worker";
import { isAdminRole } from "@/lib/roles";

const ROUTE = "/PainelAlpha/Roadmap";
const PRODUCTION_PERMISSION = "roadmapProduction";
const configSchema = z
  .object({
    provider: productionProviderSchema,
    model: z.string().trim().min(1).max(120),
    autoRun: z.boolean(),
    maxToolSteps: z.number().int().min(4).max(40),
  })
  .strict();
const executionIdSchema = z.string().min(1).max(240);
const implementationFeedbackSchema = z
  .object({
    executionId: executionIdSchema,
    feedback: z.string().trim().min(5).max(4_000),
    improvedWithAi: z.boolean().default(false),
  })
  .strict();
const userIdSchema = z.number().int().positive();

function publicError(error: unknown): string {
  if (
    error instanceof Error &&
    ["UNAUTHORIZED", "FORBIDDEN"].includes(error.message)
  )
    return "Não autorizado";
  if (error instanceof Error && error.message === "PROVIDER_NOT_READY")
    return "O provedor ou modelo selecionado não está pronto";
  return "Não foi possível concluir a operação";
}

const moduleKeySchema = z.string().trim().min(1).max(120);

export async function ObterRoadmapProduction(
  includeCatalog: boolean,
  moduleKey: string,
) {
  try {
    const access = await requireRoadmapProductionAccess();
    const scopedModuleKey = moduleKeySchema.parse(moduleKey);
    const [config, fullState, agents, providers] = await Promise.all([
      readProductionConfig(),
      refreshProductionExecutions(),
      includeCatalog ? listBibbleAgents() : Promise.resolve([]),
      includeCatalog ? diagnoseProductionProviders() : Promise.resolve([]),
    ]);
    const state = {
      ...fullState,
      executions: fullState.executions.filter(
        (execution) => execution.moduleKey === scopedModuleKey,
      ),
    };
    const artifacts = state.executions.length
      ? await db.roadmapPromptArtifact.findMany({
          where: {
            objectiveId: {
              in: state.executions.map((execution) => execution.objectiveId),
            },
            status: "PUBLISHED",
          },
          select: {
            objectiveId: true,
            documentationVersion: true,
            phaseNumber: true,
            contentMarkdown: true,
            relativePath: true,
          },
        })
      : [];
    const artifactByPhase = new Map(
      artifacts.map((artifact) => [
        `${artifact.objectiveId}:v${artifact.documentationVersion}:${artifact.phaseNumber}`,
        artifact,
      ]),
    );
    const enrichedState = {
      ...state,
      executions: state.executions.map((execution) => ({
        ...execution,
        phases: execution.phases.map((phase) => {
          const artifact = artifactByPhase.get(
            `${execution.objectiveId}:v${execution.sourceVersion}:${phase.phaseNumber}`,
          );
          return {
            ...phase,
            promptMarkdown: artifact?.contentMarkdown ?? "",
            promptPath: artifact?.relativePath ?? null,
          };
        }),
      })),
    };
    return {
      success: true as const,
      canManage: access.canMutate,
      config,
      state: enrichedState,
      agents,
      providers,
    };
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}

export async function SalvarConfiguracaoRoadmapProduction(payload: unknown) {
  try {
    await requireRoadmapProductionAccess(true);
    const input = configSchema.parse(payload);
    if (input.provider === "ollama") throw new Error("PROVIDER_NOT_READY");
    const providers = await diagnoseProductionProviders();
    const provider = providers.find((item) => item.id === input.provider);
    if (!provider?.ready || !provider.models.includes(input.model)) {
      throw new Error("PROVIDER_NOT_READY");
    }
    const config = await writeProductionConfig({ version: 1, ...input });
    revalidatePath(ROUTE);
    return { success: true as const, config };
  } catch (error) {
    if (error instanceof z.ZodError)
      return { success: false as const, error: "Revise a configuração" };
    return { success: false as const, error: publicError(error) };
  }
}

export async function ListarAcessosRoadmapProduction() {
  try {
    await requireRoadmapProductionAccess(true);
    const users = await listarAcessoModulo(PRODUCTION_PERMISSION);
    return {
      success: true as const,
      data: users.map((user) => ({
        id: user.id,
        nome: user.nome,
        usuario: user.usuario,
        role: user.role,
        status: user.status,
        imagemUrl: user.imagemUrl,
        locked: isAdminRole(user.role),
        hasAccess:
          isAdminRole(user.role) ||
          user.permissaoOverrides.some((override) => override.acao === "ADD"),
      })),
    };
  } catch (error) {
    return { success: false as const, error: publicError(error), data: [] };
  }
}

export async function AlternarAcessoRoadmapProduction(usuarioId: unknown) {
  try {
    await requireRoadmapProductionAccess(true);
    const id = userIdSchema.parse(usuarioId);
    const user = await db.usuarios.findUnique({
      where: { id },
      select: { role: true, status: true },
    });
    if (!user || user.status !== "ATIVO" || isAdminRole(user.role))
      throw new Error("FORBIDDEN");
    const result = await toggleAcessoModulo(id, PRODUCTION_PERMISSION);
    revalidatePath(ROUTE);
    return result;
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}

export async function RepetirExecucaoRoadmapProduction(executionId: unknown) {
  try {
    await requireRoadmapProductionAccess(true);
    await enqueueProductionControl(
      "RETRY",
      executionIdSchema.parse(executionId),
    );
    revalidatePath(ROUTE);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}

export async function ControlarExecucaoRoadmapProduction(
  executionId: unknown,
  control: unknown,
) {
  try {
    await requireRoadmapProductionAccess(true);
    const id = executionIdSchema.parse(executionId);
    const type = z.enum(["PAUSE", "RESUME", "EXCLUDE"]).parse(control);
    await enqueueProductionControl(type, id);
    revalidatePath(ROUTE);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}

export async function MelhorarFeedbackRoadmapProduction(payload: unknown) {
  try {
    await requireRoadmapProductionAccess(true);
    const input = implementationFeedbackSchema
      .omit({ improvedWithAi: true })
      .parse(payload);
    const state = await readProductionState();
    const execution = state.executions.find(
      (item) => item.id === input.executionId,
    );
    if (!execution) throw new Error("PRODUCTION_EXECUTION_NOT_FOUND");
    const improved = await improveRoadmapField(
      "implementationFeedback",
      input.feedback,
      {
        title: execution.objectiveTitle,
        description: `Objetivo ${execution.objectiveCode}, módulo ${execution.moduleKey}.`,
        desiredOutcome:
          "Revisar e corrigir toda a implementação do objetivo sem sair do escopo original.",
      },
    );
    return { success: true as const, improved };
  } catch (error) {
    if (error instanceof z.ZodError)
      return {
        success: false as const,
        error: "Descreva o erro com pelo menos 5 caracteres",
      };
    return { success: false as const, error: publicError(error) };
  }
}

export async function RelatarErroRoadmapProduction(payload: unknown) {
  try {
    await requireRoadmapProductionAccess(true);
    const input = implementationFeedbackSchema.parse(payload);
    const state = await readProductionState();
    const execution = state.executions.find(
      (item) => item.id === input.executionId,
    );
    if (!execution) throw new Error("PRODUCTION_EXECUTION_NOT_FOUND");
    await enqueueProductionControl(
      "REPORT_ERROR",
      execution.id,
      process.cwd(),
      {
        feedback: input.feedback,
        improvedWithAi: input.improvedWithAi,
      },
    );
    revalidatePath(ROUTE);
    return { success: true as const };
  } catch (error) {
    if (error instanceof z.ZodError)
      return { success: false as const, error: "Revise o relato do erro" };
    return { success: false as const, error: publicError(error) };
  }
}
