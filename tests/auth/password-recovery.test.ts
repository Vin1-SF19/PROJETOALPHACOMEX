import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  afterTasks: [] as Array<() => Promise<void>>,
  findUnique: vi.fn(),
  update: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  send: vi.fn(),
  hash: vi.fn(),
  consumeAuthRateLimit: vi.fn(),
}));

vi.mock("next/server", () => ({
  after: vi.fn((task: () => Promise<void>) => mocks.afterTasks.push(task)),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-forwarded-for": "203.0.113.10" })),
}));
vi.mock("@/lib/auth/rate-limit", () => ({
  consumeAuthRateLimit: mocks.consumeAuthRateLimit,
  getAuthRequestAddress: vi.fn(() => "203.0.113.10"),
  normalizeAuthIdentifier: vi.fn((value: string) => value.trim().toLowerCase().slice(0, 254)),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    usuarios: {
      findUnique: mocks.findUnique,
      update: mocks.update,
      findFirst: mocks.findFirst,
      updateMany: mocks.updateMany,
    },
  },
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));
vi.mock("bcryptjs", () => ({ hash: mocks.hash }));

import { redefinirSenha, solicitarRecuperacao } from "@/actions/RecuperarSenha";
import { hashTokenRecuperacao } from "@/lib/auth/recovery-token";

describe("recuperação de senha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.afterTasks.length = 0;
    mocks.update.mockResolvedValue({ id: 7 });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.send.mockResolvedValue({ id: "email-1" });
    mocks.hash.mockResolvedValue("bcrypt-hash");
    mocks.consumeAuthRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
    process.env.APP_URL = "https://painel.alpha.test/qualquer-path";
    process.env.RESEND_API_KEY = "test-key";
  });

  it("responde de forma idêntica para conta existente e inexistente", async () => {
    const expected = {
      success: true,
      message: "Se o e-mail estiver cadastrado, as instruções serão enviadas.",
    };

    await expect(solicitarRecuperacao(" EXISTE@ALPHA.TEST ")).resolves.toEqual(expected);
    await expect(solicitarRecuperacao("ausente@alpha.test")).resolves.toEqual(expected);
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.afterTasks).toHaveLength(2);

    mocks.findUnique.mockResolvedValueOnce({ id: 7, email: "existe@alpha.test" });
    await mocks.afterTasks[0]();
    mocks.findUnique.mockResolvedValueOnce(null);
    await mocks.afterTasks[1]();

    expect(mocks.send).toHaveBeenCalledOnce();
  });

  it("mantém a resposta genérica e não agenda e-mail quando o limite é excedido", async () => {
    mocks.consumeAuthRateLimit.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 3600 });

    await expect(solicitarRecuperacao("existe@alpha.test")).resolves.toMatchObject({ success: true });
    expect(mocks.afterTasks).toHaveLength(0);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("persiste somente o hash e envia o token bruto apenas no link", async () => {
    mocks.findUnique.mockResolvedValue({ id: 7, email: "existe@alpha.test" });
    await solicitarRecuperacao("existe@alpha.test");
    await mocks.afterTasks[0]();

    const updateCall = mocks.update.mock.calls[0][0];
    const html = mocks.send.mock.calls[0][0].html as string;
    const token = html.match(/token=([a-f0-9]{64})/)?.[1];

    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(updateCall.data.reset_token).toBe(hashTokenRecuperacao(token!));
    expect(updateCall.data.reset_token).not.toBe(token);
    expect(html).toContain("https://painel.alpha.test/auth/RedefinirSenha?token=");
  });

  it("valida o hash do token e consome o registro atomicamente", async () => {
    const token = "a".repeat(64);
    mocks.findFirst.mockResolvedValue({ id: 7 });

    await expect(redefinirSenha(token, "uma frase longa e segura")).resolves.toEqual({
      success: true,
    });

    const tokenHash = hashTokenRecuperacao(token);
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { reset_token: tokenHash, reset_expires: { gt: expect.any(Date) } },
      select: { id: true },
    });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: 7,
        reset_token: tokenHash,
        reset_expires: { gt: expect.any(Date) },
      },
      data: {
        senha: "bcrypt-hash",
        reset_token: null,
        reset_expires: null,
        senhaTemporaria: false,
        authSessionVersion: { increment: 1 },
      },
    });
  });

  it("rejeita token malformado e senha fora da política sem consultar o banco", async () => {
    await expect(redefinirSenha("token-curto", "curta")).resolves.toMatchObject({ error: expect.any(String) });
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("nega reutilização quando o consumo atômico perde a corrida", async () => {
    mocks.findFirst.mockResolvedValue({ id: 7 });
    mocks.updateMany.mockResolvedValue({ count: 0 });

    await expect(redefinirSenha("b".repeat(64), "uma frase longa e segura")).resolves.toEqual({
      error: "Token inválido ou expirado",
    });
  });
});
