import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local", override: true });

async function main() {
  try {
    const {
      executarMaintenanceAgendaAlpha,
      executarMaintenanceAgendadaAgendaAlpha,
      parseMaintenanceAgendaAlphaArgs,
    } = await import("../src/lib/google-calendar/maintenance.ts");
    const args = process.argv.slice(2);
    const summary = args[0] === "scheduled"
      ? await executarMaintenanceAgendadaAgendaAlpha(
          args.includes("--dry-run") ? "dry-run" : "apply",
        )
      : await executarMaintenanceAgendaAlpha(parseMaintenanceAgendaAlphaArgs(args));
    console.info(
      JSON.stringify({
        component: "agenda-alpha-maintenance-cli",
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
        error.message.includes(" exige ") ||
        error.message.startsWith("Escolha "));
    console.error(
      JSON.stringify({
        ok: false,
        component: "agenda-alpha-maintenance-cli",
        event: "failed",
        timestamp: new Date().toISOString(),
        code: isConfigError
          ? "INVALID_CONFIG"
          : isInvalidArgument
            ? "INVALID_ARGUMENT"
            : "MAINTENANCE_FAILED",
        error: isConfigError
          ? "Configuração inválida da Agenda Alpha"
          : isInvalidArgument
            ? "Argumentos inválidos"
            : "Falha operacional da manutenção",
      }),
    );
    process.exitCode = isConfigError ? 2 : 1;
  } finally {
    const { default: db } = await import("../src/lib/prisma.ts");
    await db.$disconnect();
  }
}

await main();
