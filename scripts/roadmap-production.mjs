import { config } from "dotenv";

config({ path: ".env", quiet: true });
config({ path: ".env.local", override: true, quiet: true });

const command = process.argv[2] ?? "doctor";

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
      listBibbleAgents(),
      diagnoseProductionProviders(),
      readProductionConfig(),
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
    await refreshProductionExecutions();
    const [productionConfig, state] = await Promise.all([
      readProductionConfig(),
      readProductionState(),
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
    await retryProductionExecution(executionId, adoptedChanges);
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
    const queued = await enqueueProductionControl(action, executionId);
    emit({
      ok: true,
      code: 0,
      command,
      executionId,
      action: queued.type,
      queued: true,
    });
  } else if (command === "worker") {
    const { processNextProductionPhase, recoverInterruptedProduction } =
      await import("../src/lib/roadmap-production/worker.ts");
    const once = process.argv.includes("--once");
    await recoverInterruptedProduction();
    if (once) {
      const result = await processNextProductionPhase();
      emit(result);
      process.exitCode = result.success === false ? 1 : 0;
    } else {
      let lastHeartbeat = 0;
      while (supervisorIsAlive()) {
        const result = await processNextProductionPhase();
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
