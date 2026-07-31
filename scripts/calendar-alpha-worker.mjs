import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local", override: true });

async function main() {
  const abortController = new AbortController();
  let shuttingDown = false;
  const requestShutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(
      JSON.stringify({
        component: "agenda-alpha-worker-cli",
        event: "shutdown_requested",
        signal,
        timestamp: new Date().toISOString(),
      }),
    );
    abortController.abort();
  };
  process.once("SIGINT", () => requestShutdown("SIGINT"));
  process.once("SIGTERM", () => requestShutdown("SIGTERM"));
  try {
    const { executarWorkerAgendaAlpha, parseWorkerAgendaAlphaArgs } =
      await import("../src/lib/google-calendar/worker.ts");
    const options = parseWorkerAgendaAlphaArgs(process.argv.slice(2));
    const summary = await executarWorkerAgendaAlpha(options, {
      signal: abortController.signal,
    });
    console.info(
      JSON.stringify({
        component: "agenda-alpha-worker-cli",
        event: "finished",
        correlationId: summary.correlationId,
        timestamp: new Date().toISOString(),
        ok: summary.operationalFailures === 0,
        summary,
      }),
    );
    process.exitCode = summary.operationalFailures > 0 ? 1 : 0;
  } catch (error) {
    const isConfigError =
      error instanceof Error && error.name === "AgendaAlphaConfigError";
    const isInvalidArgument =
      error instanceof Error &&
      (error.message.startsWith("Informe ") ||
        error.message.startsWith("Argumento ") ||
        error.message.startsWith("--"));
    console.error(
      JSON.stringify({
        ok: false,
        component: "agenda-alpha-worker-cli",
        event: "failed",
        timestamp: new Date().toISOString(),
        code: isConfigError
          ? "INVALID_CONFIG"
          : isInvalidArgument
            ? "INVALID_ARGUMENT"
            : "WORKER_FAILED",
        error: isConfigError
          ? "Configuração inválida da Agenda Alpha"
          : isInvalidArgument
            ? "Argumentos inválidos"
            : "Falha operacional do worker",
      }),
    );
    process.exitCode = isConfigError ? 2 : 1;
  } finally {
    const { default: db } = await import("../src/lib/prisma.ts");
    await db.$disconnect();
  }
}

await main();
