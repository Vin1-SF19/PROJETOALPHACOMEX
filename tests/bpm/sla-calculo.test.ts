import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { calcularPrazoFinal, calcularStatusSla } from "@/lib/bpm/sla";

describe("motor de cálculo de SLA", () => {
  it.each([
    ["MINUTOS", 30, "2026-09-04T12:30:00.000Z"],
    ["HORAS", 4, "2026-09-04T16:00:00.000Z"],
    ["DIAS", 2, "2026-09-06T12:00:00.000Z"],
    ["DIAS_UTEIS", 1, "2026-09-07T12:00:00.000Z"],
  ] as const)("calcula prazo em %s", (unidade, quantidade, esperado) => {
    expect(calcularPrazoFinal({ unidade, quantidade }, new Date("2026-09-04T12:00:00.000Z")).toISOString()).toBe(esperado);
  });

  it("transita por limite configurável e atraso sem cortes de aviso hardcoded", () => {
    const instancia = {
      status: "DENTRO_PRAZO" as const,
      inicioContagem: new Date("2026-09-04T10:00:00.000Z"),
      prazoFinal: new Date("2026-09-04T12:00:00.000Z"),
      deadline: new Date("2026-09-04T12:00:00.000Z"),
      pausadoEm: null,
      concluidoEm: null,
    };
    const limite = {
      ativo: true,
      ordem: 1,
      statusResultante: "PROXIMO_VENCIMENTO" as const,
      tipoLimite: "TEMPO_RESTANTE" as const,
      unidade: "MINUTOS" as const,
      valor: 30,
    };
    expect(calcularStatusSla(instancia, limite, new Date("2026-09-04T11:29:59.000Z"))).toBe("DENTRO_PRAZO");
    expect(calcularStatusSla(instancia, limite, new Date("2026-09-04T11:30:00.000Z"))).toBe("PROXIMO_VENCIMENTO");
    expect(calcularStatusSla(instancia, limite, new Date("2026-09-04T12:00:01.000Z"))).toBe("ATRASADO");
  });

  it("mantém pausa e conclusão como estados terminais do cálculo dinâmico", () => {
    const base = {
      inicioContagem: new Date("2026-09-04T10:00:00.000Z"),
      prazoFinal: new Date("2026-09-04T12:00:00.000Z"),
      deadline: new Date("2026-09-04T12:00:00.000Z"),
    };
    const limite = { ativo: true, ordem: 1, statusResultante: "PROXIMO_VENCIMENTO" as const, tipoLimite: "TEMPO_RESTANTE" as const, unidade: "MINUTOS" as const, valor: 30 };
    expect(calcularStatusSla({ ...base, status: "PAUSADO", pausadoEm: new Date(), concluidoEm: null }, limite)).toBe("PAUSADO");
    expect(calcularStatusSla({ ...base, status: "CONCLUIDO", pausadoEm: null, concluidoEm: new Date() }, limite)).toBe("CONCLUIDO");
  });

  it("mantém a sincronização de SLA dentro da transação de movimento", () => {
    const cards = readFileSync(resolve(process.cwd(), "src/actions/bpm/Cards.ts"), "utf8");
    expect(cards).toContain("sincronizarSlaMovimentoBpm({");
    expect(cards.indexOf("sincronizarSlaMovimentoBpm({")).toBeGreaterThan(cards.indexOf("const resultadoMovimento = await db.$transaction"));
    expect(cards).toContain("etapaOrigemNome: cardAtual.etapa.nome");
    expect(cards).toContain("etapaDestinoNome: destinoAtual.nome");
  });

  it("expõe pausa e retomada com acumulação em milissegundos", async () => {
    vi.resetModules();
    const transaction = vi.fn();
    vi.doMock("@/lib/prisma", () => ({ default: { $transaction: transaction } }));
    const { pausarSla, retomarSla } = await import("@/lib/bpm/sla");
    const updatePausa = vi.fn().mockResolvedValue({ count: 1 });
    const updateRetomada = vi.fn().mockResolvedValue({ count: 1 });
    const inicio = new Date("2026-09-04T10:00:00.000Z");
    const prazo = new Date("2026-09-04T12:00:00.000Z");
    const pausadoEm = new Date("2026-09-04T11:00:00.000Z");
    transaction.mockImplementationOnce(async (callback: (client: object) => unknown) => callback({
      bpmSlaInstancia: {
        findUnique: vi.fn().mockResolvedValue({
          id: "sla-1", status: "DENTRO_PRAZO", statusAnterior: null,
          pausadoEm: null, updatedAt: inicio, prazoFinal: prazo, deadline: prazo,
          tempoPausadoAcumuladoMs: BigInt(0),
        }),
        updateMany: updatePausa,
      },
      bpmSlaEventoLog: { create: vi.fn() },
    })).mockImplementationOnce(async (callback: (client: object) => unknown) => callback({
      bpmSlaInstancia: {
        findUnique: vi.fn().mockResolvedValue({
          id: "sla-1", status: "PAUSADO", statusAnterior: "DENTRO_PRAZO",
          pausadoEm, updatedAt: pausadoEm, prazoFinal: prazo, deadline: prazo,
          tempoPausadoAcumuladoMs: BigInt(0),
        }),
        updateMany: updateRetomada,
      },
      bpmSlaEventoLog: { create: vi.fn() },
    }));
    await pausarSla("sla-1", "standby", pausadoEm);
    await retomarSla("sla-1", new Date("2026-09-04T11:30:00.000Z"));
    expect(updatePausa).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "PAUSADO", pausadoEm }),
    }));
    expect(updateRetomada).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "DENTRO_PRAZO",
        deadline: new Date("2026-09-04T12:30:00.000Z"),
        tempoPausadoAcumuladoMs: BigInt(1_800_000),
      }),
    }));
  });
});
