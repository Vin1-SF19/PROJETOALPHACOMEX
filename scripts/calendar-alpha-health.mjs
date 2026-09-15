import { config } from "dotenv";

config({ path: ".env" });
config({ path: ".env.local", override: true });

try {
  const { obterRelatorioSaudeAgendaAlpha } = await import(
    "../src/lib/google-calendar/health-report.ts"
  );
  const relatorio = await obterRelatorioSaudeAgendaAlpha();
  console.info(JSON.stringify(relatorio, null, 2));
  process.exitCode = relatorio.ok ? 0 : 1;
} catch {
  console.error(JSON.stringify({ ok: false, error: "Falha ao diagnosticar a Agenda Alpha." }));
  process.exitCode = 2;
} finally {
  const modulo = await import("../src/lib/prisma.ts");
  const db = modulo.default?.default ?? modulo.default;
  await db.$disconnect();
}
