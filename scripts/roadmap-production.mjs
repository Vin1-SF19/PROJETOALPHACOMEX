import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";

config({ path: ".env", quiet: true });
config({ path: ".env.local", override: true, quiet: true });

const command = process.argv[2] ?? "doctor";
const workerRoot = process.env.ROADMAP_PRODUCTION_ROOT
  ? path.resolve(process.env.ROADMAP_PRODUCTION_ROOT)
  : process.cwd();

function supervisorIsAlive() {
  const supervisorPid = Number.parseInt(
    process.env.ROADMAP_PRODUCTION_SUPERVISOR_PID ?? "",
    10,
  );
  if (!Number.isSafeInteger(supervisorPid) || supervisorPid <= 0) return true;
  try {
    process.kill(supervisorPid, 0);
    return true;
  } catch {
    return false;
  }
}

function emit(value) {
  console.info(JSON.stringify(value));
}

function argument(name) {
  return process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
}

try {
  if (command === "doctor") {
    const [
      { listBibbleAgents },
      { diagnoseProductionProviders },
      { readProductionConfig },
    ] = await Promise.all([
      import("../src/lib/roadmap-production/agents.ts"),
      import("../src/lib/roadmap-production/providers.ts"),
      import("../src/lib/roadmap-production/storage.ts"),
    ]);
    const [agents, providers, productionConfig] = await Promise.all([
      listBibbleAgents(process.cwd()),
      diagnoseProductionProviders(),
      readProductionConfig(workerRoot),
    ]);
    const selected = providers.find(
      (provider) => provider.id === productionConfig.provider,
    );
    const ready = Boolean(
      selected?.ready &&
      (productionConfig.provider !== "ollama" ||
        selected.models.includes(productionConfig.model)),
    );
    emit({
      ok: ready,
      code: ready ? 0 : 1,
      command,
      config: {
        provider: productionConfig.provider,
        model: productionConfig.model,
        autoRun: productionConfig.autoRun,
        maxToolSteps: productionConfig.maxToolSteps,
      },
      providers,
      agents: {
        installed: agents.filter((agent) => agent.available).length,
        total: agents.length,
        ids: agents.filter((agent) => agent.available).map((agent) => agent.id),
      },
      timestamp: new Date().toISOString(),
    });
    process.exitCode = ready ? 0 : 1;
  } else if (command === "status") {
    const [
      { readProductionConfig, readProductionState },
      { refreshProductionExecutions },
    ] = await Promise.all([
      import("../src/lib/roadmap-production/storage.ts"),
      import("../src/lib/roadmap-production/worker.ts"),
    ]);
    await refreshProductionExecutions(workerRoot);
    const [productionConfig, state] = await Promise.all([
      readProductionConfig(workerRoot),
      readProductionState(workerRoot),
    ]);
    emit({ ok: true, code: 0, command, config: productionConfig, state });
  } else if (command === "retry") {
    const executionId = process.argv
      .find((argument) => argument.startsWith("--execution="))
      ?.slice("--execution=".length);
    if (!executionId) throw new Error("EXECUTION_ID_REQUIRED");
    const adoptedChanges = process.argv
      .filter((argument) => argument.startsWith("--adopt-change="))
      .map((argument) => argument.slice("--adopt-change=".length));
    const { retryProductionExecution } =
      await import("../src/lib/roadmap-production/worker.ts");
    await retryProductionExecution(executionId, adoptedChanges, workerRoot);
    emit({ ok: true, code: 0, command, executionId, adoptedChanges });
    const { default: db } = await import("../src/lib/prisma.ts");
    await db.$disconnect();
  } else if (command === "control") {
    const executionId = process.argv
      .find((argument) => argument.startsWith("--execution="))
      ?.slice("--execution=".length);
    const action = process.argv
      .find((argument) => argument.startsWith("--action="))
      ?.slice("--action=".length)
      ?.toUpperCase();
    if (!executionId) throw new Error("EXECUTION_ID_REQUIRED");
    if (!["PAUSE", "RESUME", "RETRY", "EXCLUDE"].includes(action ?? ""))
      throw new Error("CONTROL_ACTION_REQUIRED");
    const { enqueueProductionControl } =
      await import("../src/lib/roadmap-production/storage.ts");
    const queued = await enqueueProductionControl(action, executionId, workerRoot);
    emit({
      ok: true,
      code: 0,
      command,
      executionId,
      action: queued.type,
      queued: true,
    });
  } else if (["interventions", "history"].includes(command)) {
    const executionId = argument("execution");
    if (!executionId) throw new Error("EXECUTION_ID_REQUIRED");
    const { readProductionState } =
      await import("../src/lib/roadmap-production/storage.ts");
    const state = await readProductionState(workerRoot);
    const execution = state.executions.find((item) => item.id === executionId);
    if (!execution) throw new Error("PRODUCTION_EXECUTION_NOT_FOUND");
    emit({
      ok: true,
      code: 0,
      command,
      executionId,
      data:
        command === "interventions"
          ? execution.interventions.filter((item) => item.status === "PENDING")
          : {
              messages: execution.messages,
              interventions: execution.interventions,
              phases: execution.phases,
            },
    });
  } else if (["respond", "authorize", "deny", "message", "switch-agent"].includes(command)) {
    const executionId = argument("execution");
    const phaseNumber = Number(argument("phase"));
    if (!executionId) throw new Error("EXECUTION_ID_REQUIRED");
    if (!Number.isInteger(phaseNumber) || phaseNumber < 0) throw new Error("PHASE_NUMBER_REQUIRED");
    const requestId = argument("request");
    const content = argument("content");
    const agentId = argument("agent");
    const author = argument("author") ?? "Administrador via CLI";
    const type = {
      respond: "RESPOND",
      authorize: "AUTHORIZE",
      deny: "DENY",
      message: "MESSAGE",
      "switch-agent": "SWITCH_AGENT",
    }[command];
    const [contracts, storage, interactions, agentsModule] = await Promise.all([
      import("../src/lib/roadmap-production/contracts.ts"),
      import("../src/lib/roadmap-production/storage.ts"),
      import("../src/lib/roadmap-production/interactions.ts"),
      import("../src/lib/roadmap-production/agents.ts"),
    ]);
    const preview = contracts.productionControlCommandSchema.parse({
      id: randomUUID(),
      type,
      executionId,
      phaseNumber,
      requestId: requestId ?? null,
      content: content ?? null,
      agentId: agentId ?? null,
      author,
      createdAt: new Date().toISOString(),
    });
    const [state, agents, queuedControls] = await Promise.all([
      storage.readProductionState(workerRoot),
      agentsModule.listBibbleAgents(process.cwd()),
      storage.readProductionControls(workerRoot),
    ]);
    const phase = state.executions
      .find((execution) => execution.id === executionId)
      ?.phases.find((item) => item.phaseNumber === phaseNumber);
    const validated = contracts.productionControlCommandSchema.parse({
      ...preview,
      acceptedPhaseStatus: type === "MESSAGE" ? (phase?.status ?? null) : null,
    });
    interactions.assertNoQueuedInterventionResponse(
      queuedControls.map((item) => item.command),
      validated,
    );
    interactions.validateInteractionCommand(
      state,
      validated,
      new Set(agents.filter((agent) => agent.available).map((agent) => agent.id)),
    );
    const queued = await storage.enqueueProductionControl(type, executionId, workerRoot, {
      phaseNumber,
      requestId,
      content,
      agentId,
      author,
      acceptedPhaseStatus: validated.acceptedPhaseStatus,
    });
    emit({ ok: true, code: 0, command, executionId, commandId: queued.id, queued: true });
  } else if (command === "worker") {
    const { processNextProductionPhase, recoverInterruptedProduction } =
      await import("../src/lib/roadmap-production/worker.ts");
    const once = process.argv.includes("--once");
    await recoverInterruptedProduction(workerRoot);
    if (once) {
      const result = await processNextProductionPhase(workerRoot);
      emit(result);
      process.exitCode = result.success === false ? 1 : 0;
    } else {
      let lastHeartbeat = 0;
      while (supervisorIsAlive()) {
        const result = await processNextProductionPhase(workerRoot);
        const currentTime = Date.now();
        if (result.processed || currentTime - lastHeartbeat >= 60_000) {
          emit(
            result.processed
              ? result
              : { ...result, timestamp: new Date(currentTime).toISOString() },
          );
          if (!result.processed) lastHeartbeat = currentTime;
        }
        if (!supervisorIsAlive()) break;
        if (!result.processed)
          await new Promise((resolve) => setTimeout(resolve, 5_000));
      }
      emit({ processed: false, healthy: true, supervisorStopped: true });
    }
    const { default: db } = await import("../src/lib/prisma.ts");
    await db.$disconnect();
  } else {
    emit({ ok: false, code: 2, command, errorCode: "UNKNOWN_COMMAND" });
    process.exitCode = 2;
  }
} catch (error) {
  const errorCode =
    error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
      ? error.message.slice(0, 100)
      : "PRODUCTION_CLI_FAILED";
  emit({
    ok: false,
    code: 2,
    command,
    errorCode,
    timestamp: new Date().toISOString(),
  });
  process.exitCode = 2;
}
