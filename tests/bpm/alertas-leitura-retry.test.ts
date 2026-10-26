import { afterEach, describe, expect, it, vi } from "vitest";
import { erroTimeoutConexaoAlertas, repetirLeituraAlertas } from "@/lib/bpm/alertas-leitura-retry";

const timeout = { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } };
describe("recuperação restrita da leitura de alertas", () => {
  afterEach(() => vi.useRealTimers());

  it("reconhece o código comprovado em cause e no envelope Prisma, sem aceitar outros erros", () => {
    expect(erroTimeoutConexaoAlertas(new TypeError("fetch failed", { cause: timeout }))).toBe(true);
    expect(erroTimeoutConexaoAlertas({ meta: { driverAdapterError: timeout } })).toBe(true);
    for (const erro of [null, "UND_ERR_CONNECT_TIMEOUT", new Error("fetch failed"),
      { code: "P1008" }, { code: "SQLITE_BUSY" }, { code: "UND_ERR_SOCKET" }, { code: "ECONNRESET" }]) {
      expect(erroTimeoutConexaoAlertas(erro)).toBe(false);
    }
    const ciclo: { cause?: unknown } = {}; ciclo.cause = ciclo;
    expect(erroTimeoutConexaoAlertas(ciclo)).toBe(false);
  });

  it("aguarda 250ms e recupera em uma única repetição", async () => {
    vi.useFakeTimers();
    const ler = vi.fn().mockRejectedValueOnce(timeout).mockResolvedValue("alertas");
    const resultado = repetirLeituraAlertas(ler, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(249);
    expect(ler).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    await expect(resultado).resolves.toBe("alertas");
    expect(ler).toHaveBeenCalledTimes(2);
  });

  it("propaga indisponibilidade persistente e erros permanentes sem repetições adicionais", async () => {
    vi.useFakeTimers();
    const ler = vi.fn().mockRejectedValue(timeout);
    const rejeicao = expect(repetirLeituraAlertas(ler, new AbortController().signal)).rejects.toBe(timeout);
    await vi.advanceTimersByTimeAsync(250);
    await rejeicao;
    expect(ler).toHaveBeenCalledTimes(2);
    const erro = new Error("Campo inválido");
    const permanente = vi.fn().mockRejectedValue(erro);
    await expect(repetirLeituraAlertas(permanente, new AbortController().signal)).rejects.toBe(erro);
    expect(permanente).toHaveBeenCalledOnce();
  });

  it("não inicia nem repete uma leitura cancelada", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const ler = vi.fn().mockRejectedValue(timeout);
    const rejeicao = expect(repetirLeituraAlertas(ler, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(100);
    controller.abort();
    await vi.advanceTimersByTimeAsync(150);
    await rejeicao;
    expect(ler).toHaveBeenCalledOnce();
    ler.mockClear();
    await expect(repetirLeituraAlertas(ler, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(ler).not.toHaveBeenCalled();
  });
});
