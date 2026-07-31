import { beforeEach, describe, expect, it, vi } from "vitest";

import { GoogleCalendarError } from "@/lib/google-calendar/errors";
import type { GoogleEventoDTO, ResultadoPaginaEventos } from "@/lib/google-calendar/types";

const prismaMock = vi.hoisted(() => {
  const transacao = {
    googleCalendarEventoCache: { createMany: vi.fn(), deleteMany: vi.fn() },
    googleCalendarSelecionado: { update: vi.fn() },
  };
  return {
    ...transacao,
    $transaction: vi.fn(
      (callback: (tx: typeof transacao) => Promise<unknown>) => callback(transacao),
    ),
  };
});
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

const listarEventosPaginaMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/google-calendar/client", () => ({ listarEventosPagina: listarEventosPaginaMock }));

import { sincronizarCalendario } from "@/lib/google-calendar/sync";

function evento(overrides: Partial<GoogleEventoDTO> = {}): GoogleEventoDTO {
  return {
    googleEventId: "evt_1",
    status: "confirmed",
    titulo: "Reunião",
    descricao: null,
    localizacao: null,
    inicio: { dataHora: "2026-07-18T14:00:00-03:00" },
    fim: { dataHora: "2026-07-18T15:00:00-03:00" },
    diaInteiro: false,
    recorrenciaRegras: null,
    eventoRecorrenteIdOrigem: null,
    participantes: [],
    linkMeet: null,
    etag: "etag-1",
    atualizadoEm: "2026-07-18T10:00:00Z",
    visibilidade: "default",
    ...overrides,
  };
}

function pagina(overrides: Partial<ResultadoPaginaEventos> = {}): ResultadoPaginaEventos {
  return { eventos: [], proximoPageToken: null, proximoSyncToken: "novo-sync-token", ...overrides };
}

const CALENDARIO = { id: "cal_1", googleCalendarId: "primary", syncToken: null };

describe("sincronizarCalendario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("full sync (sem syncToken) upserta eventos e avança o cursor só no final", async () => {
    listarEventosPaginaMock.mockResolvedValueOnce(pagina({ eventos: [evento()] }));

    const resultado = await sincronizarCalendario(CALENDARIO, "usuario@empresa.com");

    expect(resultado).toMatchObject({
      ok: true,
      contadores: {
        eventosRecebidos: 1,
        eventosAtualizados: 1,
        eventosRemovidos: 0,
        paginasProcessadas: 1,
      },
    });
    expect(prismaMock.googleCalendarEventoCache.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          calendarioId: "cal_1",
          googleEventId: "evt_1",
        }),
      ],
    });
    expect(prismaMock.googleCalendarSelecionado.update).toHaveBeenCalledWith({
      where: { id: "cal_1" },
      data: { syncToken: "novo-sync-token", ultimaSincronizacaoEm: expect.any(Date) },
    });
  });

  it("paginação: só avança o cursor depois que TODAS as páginas tiveram sucesso", async () => {
    listarEventosPaginaMock
      .mockResolvedValueOnce(pagina({ eventos: [evento({ googleEventId: "evt_1" })], proximoPageToken: "pagina-2", proximoSyncToken: null }))
      .mockResolvedValueOnce(pagina({ eventos: [evento({ googleEventId: "evt_2" })], proximoPageToken: null, proximoSyncToken: "sync-final" }));

    const resultado = await sincronizarCalendario(CALENDARIO, "usuario@empresa.com");

    expect(resultado).toMatchObject({
      ok: true,
      contadores: {
        eventosRecebidos: 2,
        eventosAtualizados: 2,
        eventosRemovidos: 0,
        paginasProcessadas: 2,
      },
    });
    expect(listarEventosPaginaMock).toHaveBeenCalledTimes(2);
    expect(prismaMock.googleCalendarEventoCache.createMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.googleCalendarEventoCache.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ googleEventId: "evt_1" }),
        expect.objectContaining({ googleEventId: "evt_2" }),
      ]),
    });
    expect(prismaMock.googleCalendarSelecionado.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ syncToken: "sync-final" }) }),
    );
  });

  it("evento cancelado remove do cache em vez de upsertar", async () => {
    listarEventosPaginaMock.mockResolvedValueOnce(pagina({ eventos: [evento({ status: "cancelled" })] }));

    await sincronizarCalendario(CALENDARIO, "usuario@empresa.com");

    expect(prismaMock.googleCalendarEventoCache.deleteMany).toHaveBeenCalledWith({
      where: {
        calendarioId: "cal_1",
        googleEventId: { in: ["evt_1"] },
      },
    });
    expect(prismaMock.googleCalendarEventoCache.createMany).not.toHaveBeenCalled();
  });

  it("incremental sync usa syncToken existente e ignora timeMin/timeMax", async () => {
    listarEventosPaginaMock.mockResolvedValueOnce(pagina({ eventos: [] }));

    await sincronizarCalendario({ ...CALENDARIO, syncToken: "token-anterior" }, "usuario@empresa.com");

    expect(listarEventosPaginaMock).toHaveBeenCalledWith(
      expect.objectContaining({ syncToken: "token-anterior", timeMin: undefined, timeMax: undefined }),
    );
  });

  it("410 Gone só substitui cache/syncToken depois do full sync bem-sucedido", async () => {
    const erro410 = new GoogleCalendarError("Sync token expirado", { kind: "gone" });
    listarEventosPaginaMock
      .mockRejectedValueOnce(erro410) // tentativa incremental falha
      .mockResolvedValueOnce(pagina({ eventos: [evento()] })); // full sync de recuperação

    const resultado = await sincronizarCalendario({ ...CALENDARIO, syncToken: "token-expirado" }, "usuario@empresa.com");

    expect(resultado).toMatchObject({ ok: true });
    expect(prismaMock.googleCalendarEventoCache.deleteMany).toHaveBeenCalledWith({ where: { calendarioId: "cal_1" } });
    expect(prismaMock.googleCalendarSelecionado.update).not.toHaveBeenCalledWith({
      where: { id: "cal_1" },
      data: { syncToken: null },
    });
    expect(listarEventosPaginaMock).toHaveBeenCalledTimes(2);
    expect(prismaMock.googleCalendarEventoCache.createMany).toHaveBeenCalledTimes(1);
  });

  it("não entra em loop infinito se o full sync de recuperação também receber 410", async () => {
    const erro410 = new GoogleCalendarError("Sync token expirado", { kind: "gone" });
    listarEventosPaginaMock.mockRejectedValue(erro410);

    const resultado = await sincronizarCalendario({ ...CALENDARIO, syncToken: "token-expirado" }, "usuario@empresa.com");

    expect(resultado.ok).toBe(false);
    expect(listarEventosPaginaMock).toHaveBeenCalledTimes(2); // 1 tentativa original + 1 retry, nunca mais
  });

  it("410 seguido de falha no full preserva cache e syncToken anteriores", async () => {
    listarEventosPaginaMock
      .mockRejectedValueOnce(
        new GoogleCalendarError("Sync token expirado", { kind: "gone" }),
      )
      .mockRejectedValueOnce(
        new GoogleCalendarError("Google indisponível", { kind: "unavailable" }),
      );

    const resultado = await sincronizarCalendario(
      { ...CALENDARIO, syncToken: "token-anterior" },
      "usuario@empresa.com",
    );

    expect(resultado).toMatchObject({
      ok: false,
      erro: "O provedor de calendário está temporariamente indisponível.",
      codigo: "GOOGLE_UNAVAILABLE",
      permanent: false,
      retryable: false,
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.googleCalendarEventoCache.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.googleCalendarSelecionado.update).not.toHaveBeenCalled();
  });

  it("erro não-410 não avança o cursor e retorna erro", async () => {
    listarEventosPaginaMock.mockRejectedValueOnce(
      new GoogleCalendarError("Indisponível", { kind: "unavailable" }),
    );

    const resultado = await sincronizarCalendario(CALENDARIO, "usuario@empresa.com");

    expect(resultado).toMatchObject({
      ok: false,
      erro: "O provedor de calendário está temporariamente indisponível.",
      codigo: "GOOGLE_UNAVAILABLE",
    });
    expect(prismaMock.googleCalendarSelecionado.update).not.toHaveBeenCalled();
  });

  it("persiste carga grande em lotes seguros dentro da mesma transação", async () => {
    const eventos = Array.from({ length: 120 }, (_, indice) =>
      evento({ googleEventId: `evt_${indice + 1}` }),
    );
    listarEventosPaginaMock.mockResolvedValueOnce(pagina({ eventos }));

    const resultado = await sincronizarCalendario(
      { ...CALENDARIO, syncToken: "token-anterior" },
      "usuario@empresa.com",
    );

    expect(resultado).toMatchObject({
      ok: true,
      contadores: {
        eventosRecebidos: 120,
        eventosAtualizados: 120,
      },
    });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.googleCalendarEventoCache.createMany).toHaveBeenCalledTimes(
      3,
    );
    for (const [argumento] of prismaMock.googleCalendarEventoCache.createMany
      .mock.calls) {
      expect(argumento.data.length).toBeLessThanOrEqual(50);
    }
    expect(
      prismaMock.googleCalendarEventoCache.createMany.mock.invocationCallOrder.at(
        -1,
      ),
    ).toBeLessThan(
      prismaMock.googleCalendarSelecionado.update.mock.invocationCallOrder[0],
    );
  });

  it.each([
    {
      kind: "auth_expired" as const,
      status: 401,
      codigo: "GOOGLE_AUTH_EXPIRED",
    },
    {
      kind: "forbidden" as const,
      status: 403,
      codigo: "GOOGLE_FORBIDDEN",
    },
  ])(
    "propaga $status como falha permanente sem mensagem sensível",
    async ({ kind, status, codigo }) => {
      listarEventosPaginaMock.mockRejectedValueOnce(
        new GoogleCalendarError(
          "segredo=token-privado; subject=usuario@empresa.com",
          { kind, status, retryable: false },
        ),
      );

      const resultado = await sincronizarCalendario(
        CALENDARIO,
        "usuario@empresa.com",
      );

      expect(resultado).toMatchObject({
        ok: false,
        codigo,
        permanent: true,
        retryable: false,
      });
      if (resultado.ok) {
        throw new Error("A sincronização deveria ter falhado.");
      }
      expect(resultado.erro).not.toContain("token-privado");
      expect(resultado.erro).not.toContain("usuario@empresa.com");
    },
  );
});
