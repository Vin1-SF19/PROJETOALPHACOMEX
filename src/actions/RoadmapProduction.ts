"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { listarAcessoModulo, toggleAcessoModulo } from "@/actions/PermissoesSetor";
import db from "@/lib/prisma";
import { requireRoadmapProductionAccess } from "@/lib/roadmap-alpha/authorization";
import { listBibbleAgents } from "@/lib/roadmap-production/agents";
import { productionProviderSchema } from "@/lib/roadmap-production/contracts";
import { diagnoseProductionProviders } from "@/lib/roadmap-production/providers";
import { readProductionConfig, readProductionState, writeProductionConfig } from "@/lib/roadmap-production/storage";
import { retryProductionExecution, syncProductionExecutions } from "@/lib/roadmap-production/worker";
import { isAdminRole } from "@/lib/roles";

const ROUTE = "/PainelAlpha/Roadmap";
const PRODUCTION_PERMISSION = "roadmapProduction";
const configSchema = z.object({
  provider: productionProviderSchema,
  model: z.string().trim().min(1).max(120),
  autoRun: z.boolean(),
  maxToolSteps: z.number().int().min(4).max(40),
}).strict();
const executionIdSchema = z.string().min(1).max(240);
const userIdSchema = z.number().int().positive();

function publicError(error: unknown): string {
  if (error instanceof Error && ["UNAUTHORIZED", "FORBIDDEN"].includes(error.message)) return "Não autorizado";
  if (error instanceof Error && error.message === "PROVIDER_NOT_READY") return "O provedor ou modelo selecionado não está pronto";
  return "Não foi possível concluir a operação";
}

export async function ObterRoadmapProduction(includeCatalog = true) {
  try {
    const access = await requireRoadmapProductionAccess();
    await syncProductionExecutions();
    const [config, state, agents, providers] = await Promise.all([
      readProductionConfig(),
      readProductionState(),
      includeCatalog ? listBibbleAgents() : Promise.resolve([]),
      includeCatalog ? diagnoseProductionProviders() : Promise.resolve([]),
    ]);
    return { success: true as const, canManage: access.canMutate, config, state, agents, providers };
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}

export async function SalvarConfiguracaoRoadmapProduction(payload: unknown) {
  try {
    await requireRoadmapProductionAccess(true);
    const input = configSchema.parse(payload);
    const providers = await diagnoseProductionProviders();
    const provider = providers.find((item) => item.id === input.provider);
    if (!provider?.ready || (input.provider === "ollama" && !provider.models.includes(input.model))) {
      throw new Error("PROVIDER_NOT_READY");
    }
    const config = await writeProductionConfig({ version: 1, ...input });
    revalidatePath(ROUTE);
    return { success: true as const, config };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false as const, error: "Revise a configuração" };
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
        hasAccess: isAdminRole(user.role) || user.permissaoOverrides.some((override) => override.acao === "ADD"),
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
    const user = await db.usuarios.findUnique({ where: { id }, select: { role: true, status: true } });
    if (!user || user.status !== "ATIVO" || isAdminRole(user.role)) throw new Error("FORBIDDEN");
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
    await retryProductionExecution(executionIdSchema.parse(executionId));
    revalidatePath(ROUTE);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}
