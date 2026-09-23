import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const httpsMock = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("node:https", () => ({ default: { get: httpsMock.get } }));

import { getEmpresaAquiData } from "@/lib/cnpj/empresa-aqui";

const CNPJ = "33000167000101";

type FakeResponse = EventEmitter & { statusCode: number; resume: ReturnType<typeof vi.fn> };
type FakeRequest = EventEmitter & {
  setTimeout: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

function response(statusCode: number, body: string) {
  const res = Object.assign(new EventEmitter(), { statusCode, resume: vi.fn() }) as FakeResponse;
  const req = Object.assign(new EventEmitter(), {
    setTimeout: vi.fn(),
    destroy: vi.fn((error?: Error) => req.emit("error", error)),
  }) as FakeRequest;
  httpsMock.get.mockImplementation((_url: URL, _options: unknown, callback: (res: FakeResponse) => void) => {
    queueMicrotask(() => {
      callback(res);
      if (statusCode >= 200 && statusCode < 300) {
        res.emit("data", Buffer.from(body));
        res.emit("end");
      }
    });
    return req;
  });
  return { res, req };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.EMPRESAQUI_TOKEN = "segredo-de-teste";
});
afterEach(() => { delete process.env.EMPRESAQUI_TOKEN; });

describe("cliente EmpresaAqui", () => {
  it("usa TLS com validação padrão e aceita payload com CNPJ correspondente", async () => {
    response(200, JSON.stringify({ cnpj: CNPJ, regime_tributario: "LUCRO REAL" }));
    await expect(getEmpresaAquiData(CNPJ)).resolves.toMatchObject({ cnpj: CNPJ, regime_tributario: "LUCRO REAL" });
    const options = httpsMock.get.mock.calls[0][1];
    expect(options).not.toHaveProperty("rejectUnauthorized", false);
  });

  it("rejeita status externo não 2xx", async () => {
    const { res } = response(503, "erro interno");
    await expect(getEmpresaAquiData(CNPJ)).rejects.toThrow();
    expect(res.resume).toHaveBeenCalled();
  });

  it("rejeita JSON inválido e CNPJ divergente", async () => {
    response(200, "não é JSON");
    await expect(getEmpresaAquiData(CNPJ)).rejects.toThrow();
    response(200, JSON.stringify({ cnpj: "11111111111111" }));
    await expect(getEmpresaAquiData(CNPJ)).rejects.toThrow();
  });

  it("rejeita resposta acima do limite", async () => {
    response(200, "x".repeat(2 * 1024 * 1024 + 1));
    await expect(getEmpresaAquiData(CNPJ)).rejects.toThrow();
  });

  it("define timeout e rejeita falha da conexão", async () => {
    const { req } = response(200, "{}");
    const pending = getEmpresaAquiData(CNPJ);
    expect(req.setTimeout).toHaveBeenCalledWith(12_000, expect.any(Function));
    req.setTimeout.mock.calls[0][1]();
    await expect(pending).rejects.toThrow();
  });
});
