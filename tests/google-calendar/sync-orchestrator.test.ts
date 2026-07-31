import { describe, expect, it, vi } from "vitest";

import { criarOrquestradorSincronizacao } from "@/lib/google-calendar/sync-orchestrator";

const calendario = {
  id: "cal-local-1",
  googleCalendarId: "primary",
  syncToken: null,
};

const contadores = {
  eventosRecebidos: 2,
  eventosAtualizados: 2,
  eventosRemovidos: 0,
  paginasProcessadas: 1,
};

describe("sync orchestrator in-process", () => {
  it("deduplica chamadas concorrentes da mesma combinação usuário/calendário", async () => {
    let concluir: (() => void) | undefined;
    const executarSync = vi.fn(
      () =>
        new Promise<{
          ok: true;
          contadores: typeof contadores;
          sincronizadoEm: Date;
        }>((resolve) => {
          concluir = () =>
            resolve({ ok: true, contadores, sincronizadoEm: new Date(1_000) });
        }),
    );
    const orquestrador = criarOrquestradorSincronizacao({
      executarSync,
      agora: () => 1_000,
    });

    const primeira = orquestrador.executar({
      userId: 7,
      calendario,
      emailUsuario: "usuario@empresa.com",
    });
    const duplicada = await orquestrador.executar({
      userId: 7,
      calendario,
      emailUsuario: "usuario@empresa.com",
    });

    expect(duplicada).toEqual({
      status: "em_andamento",
      iniciadoEm: new Date(1_000).toISOString(),
    });
    expect(executarSync).toHaveBeenCalledTimes(1);

    concluir?.();
    await expect(primeira).resolves.toMatchObject({ status: "sincronizado" });
  });

  it("aplica cooldown depois de sucesso sem alegar coordenação entre réplicas", async () => {
    let instante = 10_000;
    const executarSync = vi.fn().mockResolvedValue({
      ok: true,
      contadores,
      sincronizadoEm: new Date(instante),
    });
    const orquestrador = criarOrquestradorSincronizacao({
      executarSync,
      cooldownMs: 30_000,
      agora: () => instante,
    });

    await orquestrador.executar({
      userId: 7,
      calendario,
      emailUsuario: "usuario@empresa.com",
    });
    instante += 1_000;
    const segunda = await orquestrador.executar({
      userId: 7,
      calendario,
      emailUsuario: "usuario@empresa.com",
    });

    expect(segunda).toMatchObject({ status: "cooldown" });
    expect(executarSync).toHaveBeenCalledTimes(1);
  });

  it("aplica cooldown também depois de falha", async () => {
    let instante = 20_000;
    const executarSync = vi.fn().mockResolvedValue({
      ok: false,
      erro: "Google indisponível",
      contadores,
    });
    const orquestrador = criarOrquestradorSincronizacao({
      executarSync,
      cooldownMs: 30_000,
      agora: () => instante,
    });

    await expect(
      orquestrador.executar({
        userId: 7,
        calendario,
        emailUsuario: "usuario@empresa.com",
      }),
    ).resolves.toMatchObject({ status: "erro" });

    instante += 1_000;
    await expect(
      orquestrador.executar({
        userId: 7,
        calendario,
        emailUsuario: "usuario@empresa.com",
      }),
    ).resolves.toMatchObject({
      status: "cooldown",
      resultadoAnterior: "erro",
    });
    expect(executarSync).toHaveBeenCalledTimes(1);
  });

  it("limpa o throttle após exception e ainda aplica cooldown", async () => {
    let instante = 30_000;
    const executarSync = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({
        ok: true,
        contadores,
        sincronizadoEm: new Date(61_000),
      });
    const orquestrador = criarOrquestradorSincronizacao({
      executarSync,
      cooldownMs: 30_000,
      agora: () => instante,
    });

    await expect(
      orquestrador.executar({
        userId: 7,
        calendario,
        emailUsuario: "usuario@empresa.com",
      }),
    ).resolves.toMatchObject({ status: "erro" });

    instante += 1_000;
    await expect(
      orquestrador.executar({
        userId: 7,
        calendario,
        emailUsuario: "usuario@empresa.com",
      }),
    ).resolves.toMatchObject({ status: "cooldown" });

    instante += 30_000;
    await expect(
      orquestrador.executar({
        userId: 7,
        calendario,
        emailUsuario: "usuario@empresa.com",
      }),
    ).resolves.toMatchObject({ status: "sincronizado" });
    expect(executarSync).toHaveBeenCalledTimes(2);
  });

  it("impede sincronizações simultâneas de calendários diferentes do mesmo usuário", async () => {
    let concluir: (() => void) | undefined;
    const executarSync = vi.fn(
      () =>
        new Promise<{
          ok: true;
          contadores: typeof contadores;
          sincronizadoEm: Date;
        }>((resolve) => {
          concluir = () =>
            resolve({ ok: true, contadores, sincronizadoEm: new Date(40_000) });
        }),
    );
    const orquestrador = criarOrquestradorSincronizacao({
      executarSync,
      agora: () => 40_000,
    });

    const primeira = orquestrador.executar({
      userId: 7,
      calendario,
      emailUsuario: "usuario@empresa.com",
    });
    const segunda = await orquestrador.executar({
      userId: 7,
      calendario: { ...calendario, id: "cal-local-2" },
      emailUsuario: "usuario@empresa.com",
    });

    expect(segunda).toMatchObject({ status: "em_andamento" });
    expect(executarSync).toHaveBeenCalledTimes(1);
    concluir?.();
    await primeira;
  });

  it("isola o dedupe por usuário", async () => {
    const executarSync = vi.fn().mockResolvedValue({
      ok: true,
      contadores,
      sincronizadoEm: new Date(5_000),
    });
    const orquestrador = criarOrquestradorSincronizacao({
      executarSync,
      agora: () => 5_000,
    });

    await Promise.all([
      orquestrador.executar({
        userId: 7,
        calendario,
        emailUsuario: "um@empresa.com",
      }),
      orquestrador.executar({
        userId: 8,
        calendario,
        emailUsuario: "dois@empresa.com",
      }),
    ]);

    expect(executarSync).toHaveBeenCalledTimes(2);
  });
});
