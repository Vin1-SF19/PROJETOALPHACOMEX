import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const workerMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/google-calendar/worker", () => ({
  executarWorkerAgendaAlpha: workerMock,
}));

import { GET } from "@/app/api/calendario-alpha/jobs/worker/route";

function requisicao(token?: string): Request {
  return new Request("https://painel.example/api/calendario-alpha/jobs/worker", {
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });
}

describe("cron do worker da Agenda Alpha", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "segredo-cron";
    workerMock.mockResolvedValue({
      correlationId: "correlation-1",
      claimed: 1,
      succeeded: 1,
      retried: 0,
      deadLettered: 0,
      staleClaims: 0,
      lockContentions: 0,
      noWork: false,
      operationalFailures: 0,
    });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    vi.clearAllMocks();
  });

  it("rejeita chamada sem o segredo do cron", async () => {
    const resposta = await GET(requisicao());

    expect(resposta.status).toBe(401);
    expect(workerMock).not.toHaveBeenCalled();
  });

  it("processa no máximo um job por invocação autenticada", async () => {
    const resposta = await GET(requisicao("segredo-cron"));

    expect(resposta.status).toBe(200);
    expect(workerMock).toHaveBeenCalledWith({ mode: "once", maxJobs: 1 });
    await expect(resposta.json()).resolves.toMatchObject({
      success: true,
      data: { claimed: 1, succeeded: 1 },
    });
  });

  it("retorna erro seguro quando a configuração do worker é inválida", async () => {
    const erro = new Error("token-secreto");
    erro.name = "AgendaAlphaConfigError";
    workerMock.mockRejectedValue(erro);

    const resposta = await GET(requisicao("segredo-cron"));

    expect(resposta.status).toBe(503);
    expect(await resposta.text()).not.toContain("token-secreto");
  });

  it("está conectado ao scheduler com frequência de um minuto", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"),
    ) as { crons: Array<{ path: string; schedule: string }> };

    expect(config.crons).toContainEqual({
      path: "/api/calendario-alpha/jobs/worker",
      schedule: "* * * * *",
    });
  });
});
