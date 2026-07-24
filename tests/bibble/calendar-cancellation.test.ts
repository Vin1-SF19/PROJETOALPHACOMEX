import { beforeEach, describe, expect, it, vi } from "vitest";

const { findManyMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    googleCalendarEventoCache: {
      findMany: findManyMock,
    },
  },
}));

import {
  mensagemConfirmaCancelamentoCalendario,
  mensagemSolicitaCancelamentoCalendario,
  protegerRespostaDeFalsoCancelamento,
  resolverEventoConfirmadoDoUsuario,
  resultadoCancelamentoConcluido,
  selecionarEventoConfirmado,
} from "@/lib/bibble/calendar-cancellation";

const brainstorm = {
  googleEventId: "evt-brainstorm",
  etag: '"v1"',
  titulo: "Brainstorm",
  calendarioNome: "Agenda principal",
  status: "confirmed",
};

const festa = {
  googleEventId: "evt-festa",
  etag: '"v2"',
  titulo: "Festa de testes",
  calendarioNome: "Agenda principal",
  status: "confirmed",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Bibble calendar cancellation continuity", () => {
  it("recognizes cancellation intent but not an unrelated message", () => {
    expect(
      mensagemSolicitaCancelamentoCalendario(
        "Delete o evento Festa de testes da minha agenda",
      ),
    ).toBe(true);
    expect(mensagemSolicitaCancelamentoCalendario("Apague esse arquivo")).toBe(false);
  });

  it("recognizes the real affirmative sentence after a confirmation request", () => {
    expect(
      mensagemConfirmaCancelamentoCalendario(
        "Sim, excluir o evento Festa de testes",
      ),
    ).toBe(true);
    expect(mensagemConfirmaCancelamentoCalendario("Sim")).toBe(true);
    expect(mensagemConfirmaCancelamentoCalendario("Talvez depois")).toBe(false);
  });

  it("selects the event mentioned last in the confirmation question", () => {
    const selecionado = selecionarEventoConfirmado(
      'Havia o evento Brainstorm. Você confirma excluir o evento "Festa de testes"?',
      [brainstorm, festa],
    );

    expect(selecionado).toEqual({
      googleEventId: "evt-festa",
      etag: '"v2"',
      titulo: "Festa de testes",
      calendarioNome: "Agenda principal",
    });
  });

  it("does not guess when two active events have the same mentioned title", () => {
    expect(
      selecionarEventoConfirmado('Confirma excluir "Festa de testes"?', [
        festa,
        { ...festa, googleEventId: "evt-festa-2" },
      ]),
    ).toBeNull();
  });

  it("does not use very short titles as implicit identifiers", () => {
    expect(
      selecionarEventoConfirmado("Confirma excluir o evento TI?", [
        { ...festa, titulo: "TI" },
      ]),
    ).toBeNull();
  });

  it("resolves the pending event only inside the authenticated user query", async () => {
    findManyMock.mockResolvedValue([
      {
        googleEventId: festa.googleEventId,
        etag: festa.etag,
        titulo: festa.titulo,
        status: festa.status,
        calendario: { nome: festa.calendarioNome },
      },
    ]);

    await expect(
      resolverEventoConfirmadoDoUsuario(
        1,
        'Você confirma excluir o evento "Festa de testes"?',
      ),
    ).resolves.toMatchObject({ googleEventId: "evt-festa" });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          calendario: expect.objectContaining({
            gravavel: true,
            conexao: { userId: 1 },
          }),
        }),
      }),
    );
  });

  it("accepts success only from a real cancellation tool result", () => {
    expect(
      resultadoCancelamentoConcluido(
        "cancelar_evento_calendario",
        JSON.stringify({ ok: true, cancelado: true }),
      ),
    ).toBe(true);
    expect(
      resultadoCancelamentoConcluido(
        "listar_eventos_calendario",
        JSON.stringify({ ok: true, cancelado: true }),
      ),
    ).toBe(false);
  });

  it("replaces a hallucinated success when no cancellation tool succeeded", () => {
    expect(
      protegerRespostaDeFalsoCancelamento(
        "O evento foi cancelado e removido da sua agenda.",
        false,
      ),
    ).toContain("Não consegui executar");
    expect(
      protegerRespostaDeFalsoCancelamento(
        "O evento foi cancelado e removido da sua agenda.",
        true,
      ),
    ).toContain("foi cancelado");
    expect(
      protegerRespostaDeFalsoCancelamento(
        "Você confirma que deseja que o evento seja cancelado?",
        false,
      ),
    ).toContain("Você confirma");
  });
});
