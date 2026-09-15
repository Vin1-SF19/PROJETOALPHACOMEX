import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const raiz = process.cwd();
const ler = (...partes: string[]) => readFileSync(join(raiz, ...partes), "utf8");

describe("Agenda Alpha lifecycle operacional", () => {
  it("mantém CLI e cron de manutenção conectados ao mesmo serviço", () => {
    const pacote = JSON.parse(ler("package.json")) as { scripts: Record<string, string> };
    const vercel = JSON.parse(ler("vercel.json")) as { crons: Array<{ path: string }> };
    const rota = ler("src", "app", "api", "calendario-alpha", "jobs", "maintenance", "route.ts");

    expect(pacote.scripts["calendar-alpha:health"]).toContain("calendar-alpha-health.mjs");
    expect(vercel.crons).toContainEqual(expect.objectContaining({
      path: "/api/calendario-alpha/jobs/maintenance",
    }));
    expect(rota).toContain("executarMaintenanceAgendadaAgendaAlpha");
    expect(rota).toContain("autorizarCron");
  });

  it("ativação seleciona agenda principal e exige primeira sincronização", () => {
    const conexao = ler("src", "actions", "google-calendar-conexao.ts");
    expect(conexao).toContain("calendario.principal");
    expect(conexao).toContain("orquestrarSincronizacaoCalendario");
    expect(conexao).toContain("A Agenda foi ativada, mas a primeira sincronização não terminou");
  });

  it("seleção de agenda dispara sync e tenta preparar canal push", () => {
    const eventos = ler("src", "actions", "google-calendar-eventos.ts");
    expect(eventos).toContain("orquestrarSincronizacaoCalendario");
    expect(eventos).toContain("criarCanalPush");
  });

  it("não usa estado verde quando a saúde ainda é desconhecida", () => {
    const status = ler("src", "components", "CalendarioAlpha", "StatusSincronizacao.tsx");
    expect(status).toContain('if (!status) return <Unplug');
    expect(status).toContain('["sucesso", "sincronizado", "saudavel"].includes(status)');
  });
});
