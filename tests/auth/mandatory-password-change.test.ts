import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  updateMany: vi.fn(),
  hash: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  default: {
    usuarios: { updateMany: mocks.updateMany },
  },
}));
vi.mock("bcryptjs", () => ({ hash: mocks.hash }));
vi.mock("resend", () => ({ Resend: class {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { trocarSenhaObrigatoria } from "@/actions/onboarding";

describe("troca obrigatória de senha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "7" } });
    mocks.hash.mockResolvedValue("bcrypt-hash");
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it("grava somente se o usuário continua ativo e com senha temporária", async () => {
    await expect(trocarSenhaObrigatoria("uma frase longa e segura")).resolves.toEqual({ success: true });

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: 7, status: "ATIVO", senhaTemporaria: true },
      data: {
        senha: "bcrypt-hash",
        senhaTemporaria: false,
        primeiroAcessoEm: expect.any(Date),
        authSessionVersion: { increment: 1 },
      },
    });
  });

  it("nega o endpoint para uma sessão normal ou estado já consumido", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });

    await expect(trocarSenhaObrigatoria("uma frase longa e segura")).resolves.toEqual({
      success: false,
      error: "Esta troca obrigatória não está mais disponível.",
    });
  });

  it("aplica a política de senha no servidor antes do bcrypt", async () => {
    await expect(trocarSenhaObrigatoria("curta")).resolves.toMatchObject({ success: false });
    expect(mocks.hash).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
