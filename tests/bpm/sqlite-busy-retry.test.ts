import { afterEach, describe, expect, it, vi } from "vitest";
import { erroSqliteBusy, repetirTransacaoOcupada } from "@/lib/bpm/sqlite-busy-retry";

describe("disputa de escrita durante transição BPM", () => {
  afterEach(() => vi.useRealTimers());

  it("reconhece o lock encapsulado pelo Prisma sem repetir timeout genérico", () => {
    expect(erroSqliteBusy({ code: "P1008", meta: { driverAdapterError: {
      cause: { originalCode: "5", originalMessage: "SQLITE_BUSY: database is locked", kind: "SocketTimeout" },
    } } })).toBe(true);
    expect(erroSqliteBusy({ code: "P1008", message: "Operation has timed out", meta: {
      driverAdapterError: { cause: { kind: "SocketTimeout" } },
    } })).toBe(false);
    expect(erroSqliteBusy({ code: "SQLITE_BUSY_SNAPSHOT" })).toBe(true);
    expect(erroSqliteBusy({ code: "SQLITE_CONSTRAINT" })).toBe(false);
    const circular: { cause?: unknown } = {};
    circular.cause = circular;
    expect(erroSqliteBusy(circular)).toBe(false);
  });

  it("repete a transação inteira quando o libSQL devolve SQLITE_BUSY", async () => {
    vi.useFakeTimers();
    const executar = vi.fn()
      .mockRejectedValueOnce({ cause: { originalMessage: "SQLITE_BUSY: database is locked" } })
      .mockResolvedValueOnce({ idempotente: false });
    const resultado = repetirTransacaoOcupada(executar);
    await vi.advanceTimersByTimeAsync(200);
    await expect(resultado).resolves.toEqual({ idempotente: false });
    expect(executar).toHaveBeenCalledTimes(2);
  });

  it("limita as tentativas e não repete falhas de negócio", async () => {
    vi.useFakeTimers();
    const ocupado = new Error("SQLITE_BUSY: database is locked");
    const executar = vi.fn().mockRejectedValue(ocupado);
    const resultado = repetirTransacaoOcupada(executar);
    const rejeicao = expect(resultado).rejects.toBe(ocupado);
    await vi.advanceTimersByTimeAsync(1_400);
    await rejeicao;
    expect(executar).toHaveBeenCalledTimes(4);

    const erroNegocio = new Error("Campo obrigatório ausente");
    const falha = vi.fn().mockRejectedValue(erroNegocio);
    await expect(repetirTransacaoOcupada(falha)).rejects.toBe(erroNegocio);
    expect(falha).toHaveBeenCalledOnce();
    expect(erroSqliteBusy(erroNegocio)).toBe(false);
  });
});
