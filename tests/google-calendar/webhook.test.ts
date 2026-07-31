import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const autenticarCanalMock = vi.hoisted(() => vi.fn());
const runtimeConfigMock = vi.hoisted(() => vi.fn());
const enfileirarMock = vi.hoisted(() => vi.fn());
const registrarEventoMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => {
  const tx = {
    googleCalendarPushChannel: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    googleCalendarPendingOperation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  };
  return {
    tx,
    $transaction: vi.fn(
      (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
    ),
  };
});

vi.mock("@/lib/google-calendar/push-channels", () => ({
  autenticarCanalPush: autenticarCanalMock,
}));
vi.mock("@/lib/google-calendar/observability", () => ({
  criarCorrelationIdAgendaAlpha: () => "019fb437-c332-7b10-a85a-edb5539f1680",
  registrarEventoAgendaAlpha: registrarEventoMock,
}));
vi.mock("@/lib/google-calendar/runtime-config", () => ({
  lerAgendaAlphaRuntimeConfig: runtimeConfigMock,
}));
vi.mock("@/lib/google-calendar/sync-queue", () => ({
  enfileirarOperacao: enfileirarMock,
}));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import {
  POST,
  resetAgendaAlphaWebhookRateLimiterForTests,
} from "@/app/api/calendario-alpha/webhook/route";

function requestWebhook(
  overrides: Record<string, string> = {},
  body?: string,
): NextRequest {
  const headers = new Headers({
    "x-goog-channel-id": "channel-1",
    "x-goog-channel-token": "token-1",
    "x-goog-resource-id": "resource-1",
    "x-goog-resource-state": "exists",
    "x-goog-message-number": "42",
    ...overrides,
  });
  return new NextRequest("https://painel.example.com/api/calendario-alpha/webhook", {
    method: "POST",
    headers,
    body,
  });
}

describe("POST /api/calendario-alpha/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAgendaAlphaWebhookRateLimiterForTests();
    runtimeConfigMock.mockReturnValue({
      distributedLockEnabled: true,
      queueEnabled: true,
      pushEnabled: true,
      webhookBaseUrl: "https://painel.example.com",
      valid: true,
      errors: [],
    });
    autenticarCanalMock.mockResolvedValue({
      id: "push-1",
      calendarioId: "cal-1",
      googleChannelId: "channel-1",
      googleResourceId: "resource-1",
    });
    prismaMock.tx.googleCalendarPushChannel.updateMany.mockResolvedValue({
      count: 1,
    });
    prismaMock.tx.googleCalendarPushChannel.findUnique.mockResolvedValue({
      status: "ACTIVE",
      googleResourceId: "resource-1",
      lastMessageNumber: null,
    });
    prismaMock.tx.googleCalendarPendingOperation.findUnique.mockResolvedValue(
      null,
    );
    prismaMock.tx.googleCalendarPendingOperation.findFirst.mockResolvedValue(
      null,
    );
    enfileirarMock.mockResolvedValue({ id: "operation-1" });
  });

  it("retorna 204 somente depois de atualizar metadados e enfileirar", async () => {
    const resposta = await POST(requestWebhook());

    expect(resposta.status).toBe(204);
    expect(enfileirarMock).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarioId: "cal-1",
        operationType: "SYNC_CALENDAR",
        source: "WEBHOOK",
        pushChannelId: "push-1",
        idempotencyKey: expect.stringMatching(/^webhook:[a-f0-9]{64}$/),
      }),
      expect.objectContaining({ sql: expect.any(Object) }),
    );
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(registrarEventoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "accepted",
        googleChannelId: "channel-1",
        resourceState: "exists",
      }),
    );
  });

  it("distingue duplicata e coalescência apenas na métrica interna", async () => {
    prismaMock.tx.googleCalendarPendingOperation.findUnique.mockResolvedValueOnce({
      id: "operation-existente",
    });
    const duplicada = await POST(requestWebhook());
    expect(duplicada.status).toBe(204);
    expect(registrarEventoMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ outcome: "duplicate" }),
    );

    prismaMock.tx.googleCalendarPendingOperation.findUnique.mockResolvedValueOnce(
      null,
    );
    prismaMock.tx.googleCalendarPendingOperation.findFirst.mockResolvedValueOnce({
      id: "operation-pendente",
    });
    const coalescida = await POST(
      requestWebhook({ "x-goog-message-number": "43" }),
    );
    expect(coalescida.status).toBe(204);
    expect(registrarEventoMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ outcome: "coalesced" }),
    );
  });

  it("não responde 204 quando o enqueue falha", async () => {
    enfileirarMock.mockRejectedValue(new Error("fila indisponível"));
    expect((await POST(requestWebhook())).status).toBe(503);
  });

  it("falha fechado quando o CAS do marcador perde a corrida", async () => {
    prismaMock.tx.googleCalendarPushChannel.updateMany.mockResolvedValueOnce({
      count: 0,
    });

    const resposta = await POST(requestWebhook());

    expect(resposta.status).toBe(503);
    expect(enfileirarMock).not.toHaveBeenCalled();
    expect(registrarEventoMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        outcome: "rejected",
        reason: "PERSISTENCE_FAILED",
      }),
    );
  });

  it("rejeita headers ausentes, credencial inválida e body inesperado", async () => {
    expect(
      (await POST(requestWebhook({ "x-goog-message-number": "" }))).status,
    ).toBe(400);

    autenticarCanalMock.mockResolvedValueOnce(null);
    expect((await POST(requestWebhook())).status).toBe(403);

    expect(
      (
        await POST(
          requestWebhook(
            { "content-type": "text/plain" },
            "conteudo-inesperado",
          ),
        )
      ).status,
    ).toBe(400);
    expect(enfileirarMock).not.toHaveBeenCalled();
  });

  it("falha fechado quando push/fila/lock estão desligados", async () => {
    runtimeConfigMock.mockReturnValue({
      distributedLockEnabled: false,
      queueEnabled: false,
      pushEnabled: false,
      webhookBaseUrl: null,
      valid: true,
      errors: [],
    });

    const resposta = await POST(requestWebhook());
    expect(resposta.status).toBe(503);
    expect(autenticarCanalMock).not.toHaveBeenCalled();
    expect(enfileirarMock).not.toHaveBeenCalled();
    expect(registrarEventoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "rejected",
        reason: "FEATURE_DISABLED",
      }),
    );
  });

  it("ignora mensagem fora de ordem sem regredir marcador nem criar job", async () => {
    prismaMock.tx.googleCalendarPushChannel.findUnique.mockResolvedValue({
      status: "ACTIVE",
      googleResourceId: "resource-1",
      lastMessageNumber: "90071992547409931234567890123456",
    });

    const resposta = await POST(
      requestWebhook({
        "x-goog-message-number": "90071992547409931234567890123455",
      }),
    );

    expect(resposta.status).toBe(204);
    expect(
      prismaMock.tx.googleCalendarPushChannel.updateMany,
    ).not.toHaveBeenCalled();
    expect(enfileirarMock).not.toHaveBeenCalled();
    expect(registrarEventoMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ outcome: "duplicate" }),
    );
  });

  it("compara message number acima do limite de Number usando BigInt", async () => {
    prismaMock.tx.googleCalendarPushChannel.findUnique.mockResolvedValue({
      status: "ACTIVE",
      googleResourceId: "resource-1",
      lastMessageNumber: "90071992547409931234567890123455",
    });

    const resposta = await POST(
      requestWebhook({
        "x-goog-message-number": "90071992547409931234567890123456",
      }),
    );

    expect(resposta.status).toBe(204);
    expect(prismaMock.tx.googleCalendarPushChannel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lastMessageNumber: "90071992547409931234567890123455",
        }),
        data: expect.objectContaining({
          lastMessageNumber: "90071992547409931234567890123456",
        }),
      }),
    );
    expect(enfileirarMock).toHaveBeenCalledTimes(1);
  });

  it("limita rajada por canal antes de abrir nova transacao", async () => {
    for (let index = 0; index < 120; index += 1) {
      const resposta = await POST(
        requestWebhook({ "x-goog-message-number": String(index + 1) }),
      );
      expect(resposta.status).toBe(204);
    }

    const limitada = await POST(
      requestWebhook({ "x-goog-message-number": "121" }),
    );

    expect(limitada.status).toBe(429);
    expect(limitada.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(120);
  });

  it("limita origem antes de autenticar ou consultar o banco", async () => {
    for (let index = 0; index < 300; index += 1) {
      const resposta = await POST(
        requestWebhook({
          "x-real-ip": "198.51.100.10",
          "x-goog-message-number": "",
        }),
      );
      expect(resposta.status).toBe(400);
    }

    const limitada = await POST(
      requestWebhook({
        "x-real-ip": "198.51.100.10",
        "x-goog-message-number": "",
      }),
    );

    expect(limitada.status).toBe(429);
    expect(autenticarCanalMock).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it(
    "mantem capacidade limitada e remove a chave mais antiga ao saturar",
    async () => {
      for (let index = 0; index < 5_001; index += 1) {
        const resposta = await POST(
          requestWebhook({
            "x-real-ip": `203.0.${Math.floor(index / 256)}.${index % 256}`,
            "x-goog-message-number": "",
          }),
        );
        expect(resposta.status).toBe(400);
      }

      for (let index = 0; index < 300; index += 1) {
        const resposta = await POST(
          requestWebhook({
            "x-real-ip": "203.0.0.0",
            "x-goog-message-number": "",
          }),
        );
        expect(resposta.status).toBe(400);
      }
      expect(
        (
          await POST(
            requestWebhook({
              "x-real-ip": "203.0.0.0",
              "x-goog-message-number": "",
            }),
          )
        ).status,
      ).toBe(429);
      expect(autenticarCanalMock).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    },
    20_000,
  );
});
