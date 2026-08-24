"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  listarAcessoModulo,
  toggleAcessoModulo,
} from "@/actions/PermissoesSetor";
import db from "@/lib/prisma";
import {
  requireRoadmapAccess,
  requireRoadmapProductionAccess,
} from "@/lib/roadmap-alpha/authorization";
import { improveRoadmapField } from "@/lib/roadmap-alpha/improve-with-ai";
import { listBibbleAgents } from "@/lib/roadmap-production/agents";
import {
  productionControlCommandSchema,
  productionProviderSchema,
  type ProductionControlCommand,
} from "@/lib/roadmap-production/contracts";
import {
  assertNoQueuedInterventionResponse,
  validateInteractionCommand,
} from "@/lib/roadmap-production/interactions";
import { diagnoseProductionProviders } from "@/lib/roadmap-production/providers";
import {
  isRoadmapProductionRuntimeEnabled,
  ROADMAP_PRODUCTION_RUNTIME_DISABLED,
} from "@/lib/roadmap-production/runtime";
import {
  enqueueProductionControl,
  readProductionConfig,
  readProductionControls,
  readProductionState,
  writeProductionConfig,
} from "@/lib/roadmap-production/storage";
import {
  processNextProductionPhase,
  refreshProductionExecutions,
} from "@/lib/roadmap-production/worker";
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
const phaseNumberSchema = z.number().int().min(0).max(99);
const messageSchema = z
  .object({
    executionId: executionIdSchema,
    phaseNumber: phaseNumberSchema,
    content: z.string().trim().min(1).max(4_000),
  })
  .strict();
const interventionResponseSchema = z
  .object({
    executionId: executionIdSchema,
    phaseNumber: phaseNumberSchema,
    requestId: z.string().uuid(),
    decision: z.enum(["ANSWER", "AUTHORIZE", "DENY"]),
    content: z.string().trim().min(1).max(4_000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.decision === "ANSWER" && !value.content) {
      context.addIssue({ code: "custom", message: "ANSWER_REQUIRES_CONTENT" });
    }
  });
const switchAgentSchema = z
  .object({
    executionId: executionIdSchema,
    phaseNumber: phaseNumberSchema,
    agentId: z.string().trim().min(1).max(80),
  })
  .strict();

function publicError(error: unknown): string {
  if (
    error instanceof Error &&
    error.message === ROADMAP_PRODUCTION_RUNTIME_DISABLED
  )
    return "Produção disponível apenas no executor local";
  if (
    error instanceof Error &&
    ["UNAUTHORIZED", "FORBIDDEN"].includes(error.message)
  )
    return "Não autorizado";
  if (error instanceof Error && error.message === "PROVIDER_NOT_READY")
    return "O provedor ou modelo selecionado não está pronto";
  return "Não foi possível concluir a operação";
}

function publicInteractionError(error: unknown): {
  error: string;
  code: string;
} {
  const code =
    error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : "INTERACTION_REJECTED";
  const messages: Record<string, string> = {
    PRODUCTION_EXECUTION_NOT_FOUND: "Execução não encontrada",
    INTERACTION_PHASE_NOT_FOUND: "Fase não encontrada",
    INTERVENTION_NOT_FOUND: "Solicitação não encontrada",
    INTERVENTION_PHASE_MISMATCH: "A solicitação pertence a outra fase",
    INTERVENTION_ALREADY_RESOLVED: "Esta solicitação já foi respondida",
    INTERVENTION_COMMAND_ALREADY_QUEUED:
      "Uma resposta para esta solicitação já está na fila",
    INTERVENTION_AUTHORIZATION_FORBIDDEN:
      "Esta ação exige o protocolo especializado e não pode ser autorizada pela Sala",
    PHASE_IS_READ_ONLY: "A fase concluída é somente leitura",
    AGENT_NOT_INSTALLED: "Agente não instalado",
    AGENT_INCOMPATIBLE: "Agente incompatível com a fase",
  };
  return { error: messages[code] ?? publicError(error), code };
}

const moduleKeySchema = z.string().trim().min(1).max(120);

async function resolveModuleRoot(moduleKey: string): Promise<string> {
  const workspace = await db.roadmapWorkspace.findFirst({
    where: { moduleKey, archivedAt: null },
    select: { rootPath: true },
  });
  return workspace?.rootPath ?? process.cwd();
}

async function resolveExecutionRoot(executionId: string): Promise<string> {
  const objectiveId = executionId.replace(/:v\d+$/, "");
  const objective = await db.roadmapObjective.findUnique({
    where: { id: objectiveId },
    select: { moduleKey: true },
  });
  return objective ? resolveModuleRoot(objective.moduleKey) : process.cwd();
}

/**
 * Melhor esforço: um comando enfileirado (APPROVE/RESUME/RETRY) só é
 * efetivamente aplicado quando algo chama processNextProductionPhase — hoje
 * isso normalmente é o worker de processo separado (scripts/roadmap-production
 * .mjs worker), rodando em loop próprio. Sem esse "kick", o comando fica
 * represado até o próximo ciclo do worker externo, que pode não estar rodando.
 * Dispara UMA passagem do processamento sem bloquear a resposta da Server
 * Action ao usuário — processar uma fase de verdade pode envolver chamar CLI
 * de agente e demorar bastante. Seguro chamar de múltiplos lugares ao mesmo
 * tempo: o lease global (acquireProductionExecutionLease) é não-bloqueante,
 * então se o worker de fundo já estiver processando, este kick só recebe
 * lease nulo e não faz nada. Só dispara quando o runtime local está habilitado
 * neste processo — em ambientes sem runtime (ex.: nuvem), não há
 * processNextProductionPhase local capaz de fazer algo, então não adianta
 * tentar.
 */
function kickProductionWorker(root: string): void {
  if (!isRoadmapProductionRuntimeEnabled()) return;
  processNextProductionPhase(root).catch((error) => {
    console.error("[roadmap-production] kick pós-comando falhou:", error);
  });
}

async function authorName(userId: number): Promise<string> {
  const user = await db.usuarios.findUnique({
    where: { id: userId },
    select: { nome: true },
  });
  return user?.nome?.trim() || `Administrador #${userId}`;
}

async function enqueueValidatedInteraction(
  command: ProductionControlCommand,
  root: string,
): Promise<{ id: string }> {
  const [state, agents, queuedControls] = await Promise.all([
    readProductionState(root),
    listBibbleAgents(process.cwd()),
    readProductionControls(root),
  ]);
  const phase = state.executions
    .find((execution) => execution.id === command.executionId)
    ?.phases.find((item) => item.phaseNumber === command.phaseNumber);
  const validatedCommand = productionControlCommandSchema.parse({
    ...command,
    acceptedPhaseStatus:
      command.type === "MESSAGE" ? (phase?.status ?? null) : null,
  });
  assertNoQueuedInterventionResponse(
    queuedControls.map((item) => item.command),
    validatedCommand,
  );
  validateInteractionCommand(
    state,
    validatedCommand,
    new Set(agents.filter((agent) => agent.available).map((agent) => agent.id)),
  );
  return enqueueProductionControl(validatedCommand.type, validatedCommand.executionId, root, {
    phaseNumber: validatedCommand.phaseNumber ?? undefined,
    requestId: validatedCommand.requestId ?? undefined,
    content: validatedCommand.content ?? undefined,
    agentId: validatedCommand.agentId ?? undefined,
    author: validatedCommand.author,
    acceptedPhaseStatus: validatedCommand.acceptedPhaseStatus,
  });
}

export async function ObterRoadmapProduction(
  includeCatalog: boolean,
  moduleKey: string,
) {
  try {
    const access = await requireRoadmapProductionAccess();
    const scopedModuleKey = moduleKeySchema.parse(moduleKey);
    const root = await resolveModuleRoot(scopedModuleKey);
    const [config, fullState, agents, providers] = await Promise.all([
      readProductionConfig(root),
      refreshProductionExecutions(root),
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
    const id = executionIdSchema.parse(executionId);
    const root = await resolveExecutionRoot(id);
    await enqueueProductionControl("RETRY", id, root);
    revalidatePath(ROUTE);
    kickProductionWorker(root);
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
    const root = await resolveExecutionRoot(id);
    await enqueueProductionControl(type, id, root);
    revalidatePath(ROUTE);
    if (type === "RESUME") kickProductionWorker(root);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}

/**
 * Deliberadamente usa requireRoadmapAccess (não requireRoadmapProductionAccess)
 * — aprovar é uma decisão de gestão, não depende do runtime de execução local
 * estar habilitado (que é o que assertRoadmapProductionRuntimeEnabled exige,
 * e é justamente o que falta em ambientes como nuvem). O card de objetivo na
 * lista principal precisa poder aprovar mesmo sem acesso à tela de Produção.
 */
export async function AprovarExecucaoRoadmapProduction(executionId: unknown) {
  try {
    await requireRoadmapAccess(true);
    const id = executionIdSchema.parse(executionId);
    const root = await resolveExecutionRoot(id);
    await enqueueProductionControl("APPROVE", id, root);
    revalidatePath(ROUTE);
    kickProductionWorker(root);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}

/**
 * Deliberadamente NÃO usa requireRoadmapProductionAccess — essa função exige
 * assertRoadmapProductionRuntimeEnabled(), que bloqueia em ambientes (ex.:
 * nuvem) onde a execução local não roda. Aprovar/rejeitar são decisões de
 * gestão, não dependem do worker de execução estar disponível — só exigem
 * a mesma permissão de mutação já usada por AprovarExecucaoRoadmapProduction.
 */
export async function ListarExecucoesAguardandoAprovacao() {
  try {
    await requireRoadmapAccess(true);
    const workspaces = await db.roadmapWorkspace.findMany({
      where: { archivedAt: null },
      select: { rootPath: true },
    });
    const roots = Array.from(
      new Set([process.cwd(), ...workspaces.map((workspace) => workspace.rootPath)]),
    );
    const data: Array<{ objectiveId: string; executionId: string }> = [];
    for (const root of roots) {
      const state = await refreshProductionExecutions(root);
      data.push(
        ...state.executions
          .filter((execution) => execution.status === "AWAITING_APPROVAL")
          .map((execution) => ({
            objectiveId: execution.objectiveId,
            executionId: execution.id,
          })),
      );
    }
    return {
      success: true as const,
      data,
    };
  } catch (error) {
    return { success: false as const, error: publicError(error), data: [] };
  }
}

/**
 * Mesmo padrão de ListarExecucoesAguardandoAprovacao (auth, varredura de
 * workspaces, formato de retorno) — deliberadamente não usa
 * requireRoadmapProductionAccess pelo mesmo motivo: precisa funcionar mesmo
 * sem runtime de execução local habilitado. BLOCKED/WAITING_FOR_ADMIN são os
 * dois status que significam "esta execução parou e precisa de decisão
 * humana" (a diferença entre eles é interna — DENY/timeout de intervenção vs
 * limite de correções automáticas atingido — mas do ponto de vista do
 * usuário no dashboard principal, ambos pedem a mesma ação: abrir e olhar).
 */
export async function ListarExecucoesPrecisandoAtencao() {
  try {
    await requireRoadmapAccess(true);
    const workspaces = await db.roadmapWorkspace.findMany({
      where: { archivedAt: null },
      select: { rootPath: true },
    });
    const roots = Array.from(
      new Set([process.cwd(), ...workspaces.map((workspace) => workspace.rootPath)]),
    );
    const data: Array<{
      objectiveId: string;
      executionId: string;
      status: "BLOCKED" | "WAITING_FOR_ADMIN";
    }> = [];
    for (const root of roots) {
      const state = await refreshProductionExecutions(root);
      data.push(
        ...state.executions
          .filter(
            (
              execution,
            ): execution is typeof execution & {
              status: "BLOCKED" | "WAITING_FOR_ADMIN";
            } =>
              execution.status === "BLOCKED" ||
              execution.status === "WAITING_FOR_ADMIN",
          )
          .map((execution) => ({
            objectiveId: execution.objectiveId,
            executionId: execution.id,
            status: execution.status,
          })),
      );
    }
    return {
      success: true as const,
      data,
    };
  } catch (error) {
    return { success: false as const, error: publicError(error), data: [] };
  }
}

/**
 * Mesma varredura de workspaces das duas funções irmãs acima, mas
 * DELIBERADAMENTE sem exigir mutação (requireRoadmapAccess() em vez de
 * requireRoadmapAccess(true)) — decisão explícita do usuário: o botão
 * "Produção" no card do objetivo (RoadmapDashboard.tsx) precisa manter a
 * mesma paridade de acesso do botão antigo do header que ele substitui, e
 * aquele era visível para qualquer usuário com permissão de LEITURA de
 * Produção, não só quem pode mutar (Admin/CEO/TI). Cobre TODOS os status
 * (não só AWAITING_APPROVAL ou BLOCKED/WAITING_FOR_ADMIN), para a tela
 * principal saber se o objetivo já tem execução e para onde navegar,
 * independente de estado. Um objectiveId pode ter mais de uma execução
 * (revisões sucessivas do mesmo objetivo, ex.: ":v2" e ":v3") — mantém só a
 * mais recente por `createdAt`, já que a UI só precisa de "qual execution
 * abrir agora".
 */
export async function ListarExecucoesPorObjetivo() {
  try {
    await requireRoadmapAccess();
    const workspaces = await db.roadmapWorkspace.findMany({
      where: { archivedAt: null },
      select: { rootPath: true },
    });
    const roots = Array.from(
      new Set([process.cwd(), ...workspaces.map((workspace) => workspace.rootPath)]),
    );
    const latestByObjective = new Map<
      string,
      { objectiveId: string; executionId: string; status: string; createdAt: string }
    >();
    for (const root of roots) {
      const state = await refreshProductionExecutions(root);
      for (const execution of state.executions) {
        const current = latestByObjective.get(execution.objectiveId);
        if (current && current.createdAt >= execution.createdAt) continue;
        latestByObjective.set(execution.objectiveId, {
          objectiveId: execution.objectiveId,
          executionId: execution.id,
          status: execution.status,
          createdAt: execution.createdAt,
        });
      }
    }
    return {
      success: true as const,
      data: Array.from(latestByObjective.values()).map(
        ({ objectiveId, executionId, status }) => ({
          objectiveId,
          executionId,
          status,
        }),
      ),
    };
  } catch (error) {
    return { success: false as const, error: publicError(error), data: [] };
  }
}

export async function MelhorarFeedbackRoadmapProduction(payload: unknown) {
  try {
    await requireRoadmapProductionAccess(true);
    const input = implementationFeedbackSchema
      .omit({ improvedWithAi: true })
      .parse(payload);
    const root = await resolveExecutionRoot(input.executionId);
    const state = await readProductionState(root);
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
    const root = await resolveExecutionRoot(input.executionId);
    const state = await readProductionState(root);
    const execution = state.executions.find(
      (item) => item.id === input.executionId,
    );
    if (!execution) throw new Error("PRODUCTION_EXECUTION_NOT_FOUND");
    await enqueueProductionControl(
      "REPORT_ERROR",
      execution.id,
      root,
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

export async function EnviarMensagemRoadmapProduction(payload: unknown) {
  try {
    const access = await requireRoadmapProductionAccess(true);
    const input = messageSchema.parse(payload);
    const root = await resolveExecutionRoot(input.executionId);
    const author = await authorName(access.userId);
    const command = productionControlCommandSchema.parse({
      id: randomUUID(),
      type: "MESSAGE",
      executionId: input.executionId,
      phaseNumber: input.phaseNumber,
      content: input.content,
      author,
      createdAt: new Date().toISOString(),
    });
    const queued = await enqueueValidatedInteraction(command, root);
    revalidatePath(ROUTE);
    return { success: true as const, commandId: queued.id };
  } catch (error) {
    return { success: false as const, ...publicInteractionError(error) };
  }
}

export async function ResponderIntervencaoRoadmapProduction(payload: unknown) {
  try {
    const access = await requireRoadmapProductionAccess(true);
    const input = interventionResponseSchema.parse(payload);
    const root = await resolveExecutionRoot(input.executionId);
    const author = await authorName(access.userId);
    const type =
      input.decision === "ANSWER"
        ? "RESPOND"
        : input.decision === "AUTHORIZE"
          ? "AUTHORIZE"
          : "DENY";
    const command = productionControlCommandSchema.parse({
      id: randomUUID(),
      type,
      executionId: input.executionId,
      phaseNumber: input.phaseNumber,
      requestId: input.requestId,
      content: input.content ?? null,
      author,
      createdAt: new Date().toISOString(),
    });
    const queued = await enqueueValidatedInteraction(command, root);
    revalidatePath(ROUTE);
    return { success: true as const, commandId: queued.id };
  } catch (error) {
    return { success: false as const, ...publicInteractionError(error) };
  }
}

export async function TrocarAgenteFaseRoadmapProduction(payload: unknown) {
  try {
    const access = await requireRoadmapProductionAccess(true);
    const input = switchAgentSchema.parse(payload);
    const root = await resolveExecutionRoot(input.executionId);
    const author = await authorName(access.userId);
    const command = productionControlCommandSchema.parse({
      id: randomUUID(),
      type: "SWITCH_AGENT",
      executionId: input.executionId,
      phaseNumber: input.phaseNumber,
      agentId: input.agentId,
      author,
      createdAt: new Date().toISOString(),
    });
    const queued = await enqueueValidatedInteraction(command, root);
    revalidatePath(ROUTE);
    return { success: true as const, commandId: queued.id };
  } catch (error) {
    return { success: false as const, ...publicInteractionError(error) };
  }
}
