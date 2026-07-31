import { randomUUID } from "node:crypto";

import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local", override: true });

async function main() {
  const correlationId = randomUUID();
  const baseEvent = {
    component: "agenda-alpha-queue-cli",
    correlationId,
  };
  try {
    const { exigirAgendaAlphaRuntimeConfig, AgendaAlphaConfigError } =
      await import("../src/lib/google-calendar/runtime-config.ts");
    const {
      obterResumoFila,
      parseQueueAgendaAlphaArgs,
      recuperarClaimsExpirados,
      reprocessarOperacaoDlq,
    } = await import("../src/lib/google-calendar/sync-queue.ts");
    const command = parseQueueAgendaAlphaArgs(process.argv.slice(2));
    const runtime = exigirAgendaAlphaRuntimeConfig();
    if (
      command.command !== "status" &&
      (!runtime.queueEnabled || !runtime.distributedLockEnabled)
    ) {
      throw new AgendaAlphaConfigError([
        "mutações da fila exigem fila e lock distribuído habilitados",
      ]);
    }

    const result =
      command.command === "status"
        ? { queue: await obterResumoFila() }
        : command.command === "recover-expired"
          ? { expiredClaimsRecovered: await recuperarClaimsExpirados() }
          : {
              replayed: await reprocessarOperacaoDlq(command.operationId),
            };
    const ok = !("replayed" in result) || result.replayed;
    console.info(
      JSON.stringify({
        ...baseEvent,
        event: "finished",
        command: command.command,
        timestamp: new Date().toISOString(),
        ok,
        result,
      }),
    );
    process.exitCode = ok ? 0 : 1;
  } catch (error) {
    const isConfigError =
      error instanceof Error && error.name === "AgendaAlphaConfigError";
    const isInvalidArgument =
      error instanceof Error &&
      (error.message.startsWith("Use ") ||
        error.message.startsWith("--"));
    console.error(
      JSON.stringify({
        ...baseEvent,
        event: "failed",
        timestamp: new Date().toISOString(),
        ok: false,
        code: isConfigError
          ? "INVALID_CONFIG"
          : isInvalidArgument
            ? "INVALID_ARGUMENT"
            : "QUEUE_FAILED",
        error: isConfigError
          ? "Configuração inválida da Agenda Alpha"
          : isInvalidArgument
            ? "Argumentos inválidos"
            : "Falha operacional da fila",
      }),
    );
    process.exitCode = isConfigError ? 2 : 1;
  } finally {
    const { default: db } = await import("../src/lib/prisma.ts");
    await db.$disconnect();
  }
}

await main();
