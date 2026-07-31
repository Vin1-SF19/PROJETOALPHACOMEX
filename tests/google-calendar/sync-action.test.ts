import { beforeEach, describe, expect, it, vi } from "vitest";

const acessoMock = vi.hoisted(() => vi.fn());
const usuarioGoogleMock = vi.hoisted(() => vi.fn());
const orquestrarMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  googleCalendarConexao: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/google-calendar/autorizacao", () => ({
  verificarAcessoCalendarioAlpha: acessoMock,
}));
vi.mock("@/lib/google-calendar/usuario-google", () => ({
  obterUsuarioGoogleAtivo: usuarioGoogleMock,
}));
vi.mock("@/lib/google-calendar/sync-orchestrator", () => ({
  orquestrarSincronizacaoCalendario: orquestrarMock,
}));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import { sincronizarAgendaAlpha } from "@/actions/google-calendar-sync";

const calendarioA = {
  id: "cal-a",
  googleCalendarId: "primary",
  nome: "Principal",
  syncToken: "token-a",
};
const calendarioB = {
  id: "cal-b",
  googleCalendarId: "time",
  nome: "Time",
  syncToken: "token-b",
};
const contadoresVazios = {
  eventosRecebidos: 0,
  eventosAtualizados: 0,
  eventosRemovidos: 0,
  paginasProcessadas: 0,
};

describe("sincronizarAgendaAlpha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    acessoMock.mockResolvedValue({ autorizado: true, userId: 7 });
    usuarioGoogleMock.mockResolvedValue({
      ok: true,
      emailUsuario: "sessao@alpha.com",
      conexaoId: "conexao-1",
    });
    prismaMock.googleCalendarConexao.findUnique.mockResolvedValue({
      id: "conexao-1",
      userId: 7,
      ultimaSincronizacaoEm: new Date("2026-07-29T10:00:00Z"),
      calendarios: [calendarioA, calendarioB],
    });
  });

  it("retorna falha parcial e não avança ultimaSincronizacaoEm da conexão", async () => {
    orquestrarMock
      .mockResolvedValueOnce({
        status: "sincronizado",
        iniciadoEm: "2026-07-30T10:00:00.000Z",
        concluidoEm: "2026-07-30T10:00:01.000Z",
        contadores: {
          eventosRecebidos: 3,
          eventosAtualizados: 2,
          eventosRemovidos: 1,
          paginasProcessadas: 1,
        },
      })
      .mockResolvedValueOnce({
        status: "erro",
        iniciadoEm: "2026-07-30T10:00:01.000Z",
        concluidoEm: "2026-07-30T10:00:02.000Z",
        erro: "Google indisponível",
        contadores: contadoresVazios,
      });

    const resultado = await sincronizarAgendaAlpha();

    expect(resultado).toMatchObject({
      success: true,
      data: {
        status: "parcial",
        contadores: {
          calendariosSolicitados: 2,
          calendariosSincronizados: 1,
          calendariosComErro: 1,
          eventosRecebidos: 3,
        },
        erros: [{ calendarioId: "cal-b", mensagem: "Google indisponível" }],
        ultimaSincronizacaoEm: "2026-07-29T10:00:00.000Z",
      },
    });
    expect(prismaMock.googleCalendarConexao.update).not.toHaveBeenCalled();
  });

  it("atualiza status e ultimaSincronizacaoEm após sucesso consolidado", async () => {
    orquestrarMock.mockResolvedValue({
      status: "sincronizado",
      iniciadoEm: "2026-07-30T10:00:00.000Z",
      concluidoEm: "2026-07-30T10:00:01.000Z",
      contadores: contadoresVazios,
    });

    const resultado = await sincronizarAgendaAlpha();

    expect(resultado).toMatchObject({
      success: true,
      data: { status: "sucesso", ultimaSincronizacaoEm: expect.any(String) },
    });
    expect(prismaMock.googleCalendarConexao.update).toHaveBeenCalledWith({
      where: { id: "conexao-1" },
      data: {
        status: "ATIVA",
        ultimaSincronizacaoEm: expect.any(Date),
      },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/PainelAlpha/CalendarioAlpha",
    );
  });

  it("trata sucesso + cooldown após erro como parcial e não avança a conexão", async () => {
    orquestrarMock
      .mockResolvedValueOnce({
        status: "sincronizado",
        iniciadoEm: "2026-07-30T10:00:00.000Z",
        concluidoEm: "2026-07-30T10:00:01.000Z",
        contadores: contadoresVazios,
      })
      .mockResolvedValueOnce({
        status: "cooldown",
        ultimaTentativaEm: "2026-07-30T09:59:50.000Z",
        proximaTentativaPermitidaEm: "2026-07-30T10:00:20.000Z",
        resultadoAnterior: "erro",
      });

    const resultado = await sincronizarAgendaAlpha();

    expect(resultado).toMatchObject({
      success: true,
      data: {
        status: "parcial",
        contadores: { calendariosCooldownAposErro: 1 },
        erros: [
          {
            calendarioId: "cal-b",
            mensagem: expect.stringContaining("última tentativa"),
          },
        ],
        ultimaSincronizacaoEm: "2026-07-29T10:00:00.000Z",
      },
    });
    expect(prismaMock.googleCalendarConexao.update).not.toHaveBeenCalled();
  });

  it("trata todos em cooldown após erro como cooldown sem avançar conexão", async () => {
    orquestrarMock.mockResolvedValue({
      status: "cooldown",
      ultimaTentativaEm: "2026-07-30T09:59:50.000Z",
      proximaTentativaPermitidaEm: "2026-07-30T10:00:20.000Z",
      resultadoAnterior: "erro",
    });

    const resultado = await sincronizarAgendaAlpha();

    expect(resultado).toMatchObject({
      success: true,
      data: {
        status: "cooldown",
        contadores: {
          calendariosEmCooldown: 2,
          calendariosCooldownAposErro: 2,
        },
        erros: [{ calendarioId: "cal-a" }, { calendarioId: "cal-b" }],
        ultimaSincronizacaoEm: "2026-07-29T10:00:00.000Z",
      },
    });
    expect(prismaMock.googleCalendarConexao.update).not.toHaveBeenCalled();
  });

  it("trata sucesso + cooldown após sucesso como parcial sem avançar conexão", async () => {
    orquestrarMock
      .mockResolvedValueOnce({
        status: "sincronizado",
        iniciadoEm: "2026-07-30T10:00:00.000Z",
        concluidoEm: "2026-07-30T10:00:01.000Z",
        contadores: contadoresVazios,
      })
      .mockResolvedValueOnce({
        status: "cooldown",
        ultimaTentativaEm: "2026-07-30T09:59:50.000Z",
        proximaTentativaPermitidaEm: "2026-07-30T10:00:20.000Z",
        resultadoAnterior: "sucesso",
      });

    const resultado = await sincronizarAgendaAlpha();

    expect(resultado).toMatchObject({
      success: true,
      data: {
        status: "parcial",
        contadores: {
          calendariosSincronizados: 1,
          calendariosEmCooldown: 1,
        },
        ultimaSincronizacaoEm: "2026-07-29T10:00:00.000Z",
      },
    });
    expect(prismaMock.googleCalendarConexao.update).not.toHaveBeenCalled();
  });

  it("trata todos em cooldown após sucesso como cooldown", async () => {
    orquestrarMock.mockResolvedValue({
      status: "cooldown",
      ultimaTentativaEm: "2026-07-30T09:59:50.000Z",
      proximaTentativaPermitidaEm: "2026-07-30T10:00:20.000Z",
      resultadoAnterior: "sucesso",
    });

    const resultado = await sincronizarAgendaAlpha();

    expect(resultado).toMatchObject({
      success: true,
      data: {
        status: "cooldown",
        contadores: {
          calendariosSincronizados: 0,
          calendariosEmCooldown: 2,
        },
        ultimaSincronizacaoEm: "2026-07-29T10:00:00.000Z",
      },
    });
    expect(prismaMock.googleCalendarConexao.update).not.toHaveBeenCalled();
  });

  it("limita o total mesmo quando calendarioIds não é informado", async () => {
    prismaMock.googleCalendarConexao.findUnique.mockResolvedValue({
      id: "conexao-1",
      userId: 7,
      ultimaSincronizacaoEm: null,
      calendarios: Array.from({ length: 51 }, (_, indice) => ({
        ...calendarioA,
        id: `cal-${indice}`,
      })),
    });

    const resultado = await sincronizarAgendaAlpha();

    expect(resultado).toEqual({
      success: false,
      error: "Selecione no máximo 50 calendários por sincronização manual.",
    });
    expect(orquestrarMock).not.toHaveBeenCalled();
  });
});
