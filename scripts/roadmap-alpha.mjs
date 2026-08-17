import { config } from "dotenv";

config({ path: ".env", quiet: true });
config({ path: ".env.local", override: true, quiet: true });

const command = process.argv[2] ?? "doctor";

function supervisorIsAlive() {
  const supervisorPid = Number.parseInt(process.env.ROADMAP_SUPERVISOR_PID ?? "", 10);
  if (!Number.isSafeInteger(supervisorPid) || supervisorPid <= 0) return true;
  try {
    process.kill(supervisorPid, 0);
    return true;
  } catch {
    return false;
  }
}

try {
  const { runRoadmapDoctor, runRoadmapModuleCheck } = await import("../src/lib/roadmap-alpha/doctor.ts");
  let result;
  if (command === "doctor") {
    result = await runRoadmapDoctor();
  } else if (command === "check-modules" || command === "sync-modules") {
    result = runRoadmapModuleCheck();
  } else if (command === "worker") {
    const { processNextRoadmapJob } = await import("../src/lib/roadmap-alpha/worker.ts");
    const once = process.argv.includes("--once");
    if (once) {
      result = await processNextRoadmapJob();
      const { default: db } = await import("../src/lib/prisma.ts");
      await db.$disconnect();
    } else {
      let lastIdleHeartbeat = 0;
      while (true) {
        if (!supervisorIsAlive()) break;
        result = await processNextRoadmapJob();
        const now = Date.now();
        if (result.processed || now - lastIdleHeartbeat >= 60_000) {
          console.info(JSON.stringify(result.processed ? result : { processed: false, healthy: true, timestamp: new Date(now).toISOString() }));
          if (!result.processed) lastIdleHeartbeat = now;
        }
        if (!supervisorIsAlive()) break;
        if (!result.processed) await new Promise((resolve) => setTimeout(resolve, 5_000));
      }
      const { default: db } = await import("../src/lib/prisma.ts");
      await db.$disconnect();
      result = { processed: false, healthy: true, supervisorStopped: true };
    }
  } else if (command === "enqueue" || command === "export" || command === "reconcile") {
    const { enqueueMissingRoadmapJobs, exportRoadmapProjections, reconcileRoadmapProjections } = await import("../src/lib/roadmap-alpha/maintenance.ts");
    const objectiveCode = process.argv.find((arg) => arg.startsWith("--objective="))?.slice("--objective=".length);
    result = command === "enqueue"
      ? await enqueueMissingRoadmapJobs()
      : command === "export"
        ? await exportRoadmapProjections(objectiveCode)
        : await reconcileRoadmapProjections();
    const { default: db } = await import("../src/lib/prisma.ts");
    await db.$disconnect();
  } else {
    result = {
      ok: false,
      command: "check-modules",
      code: 2,
      checks: { cli: { ok: false, errorCode: "UNKNOWN_COMMAND" } },
      timestamp: new Date().toISOString(),
    };
  }
  console.info(JSON.stringify(result));
  process.exitCode = command === "worker" ? (result?.success === false ? 1 : 0) : result.code;
} catch {
  console.info(JSON.stringify({
    ok: false,
    command: ["doctor", "worker", "enqueue", "export", "reconcile"].includes(command) ? command : "check-modules",
    code: 2,
    checks: { cli: { ok: false, errorCode: "CLI_FAILED" } },
    timestamp: new Date().toISOString(),
  }));
  process.exitCode = 2;
}
