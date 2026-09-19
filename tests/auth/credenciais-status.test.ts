import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  compare: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    usuarios: {
      findFirst: mocks.findFirst,
    },
  },
}));

vi.mock("bcryptjs", () => ({
  compare: mocks.compare,
}));

import { findUserByCredentials } from "@/lib/user";

const usuarioBase = {
  id: 12,
  email: "colaborador@alpha.test",
  usuario: "colaborador",
  nome: "Colaborador Alpha",
  senha: "hash",
  role: "User",
  permissoes: "agenda,chamados",
  status: "ATIVO",
  authSessionVersion: 0,
  presets: [],
};

describe("login por credenciais e status do colaborador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.compare.mockResolvedValue(true);
  });

  it("permite credenciais corretas quando o status atual é ATIVO", async () => {
    mocks.findFirst.mockResolvedValue(usuarioBase);

    await expect(
      findUserByCredentials(usuarioBase.email, "senha-correta"),
    ).resolves.toMatchObject({
      id: "12",
      email: usuarioBase.email,
      permissoes: ["agenda", "chamados"],
      authSessionVersion: 0,
    });

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        email: usuarioBase.email,
        status: "ATIVO",
      },
      include: { presets: true },
    });
  });

  it.each(["INATIVO", "AFASTADO", "FÉRIAS", "FERIAS", "OUTRO"])(
    "recusa credenciais corretas quando o status é %s",
    async (status) => {
      mocks.findFirst.mockResolvedValue({ ...usuarioBase, status });

      await expect(
        findUserByCredentials(usuarioBase.email, "senha-correta"),
      ).resolves.toBeNull();
      expect(mocks.compare).toHaveBeenCalledOnce();
    },
  );

  it("recusa usuário inexistente sem revelar o motivo", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(
      findUserByCredentials("ausente@alpha.test", "senha-correta"),
    ).resolves.toBeNull();
    expect(mocks.compare).toHaveBeenCalledOnce();
    expect(mocks.compare).toHaveBeenCalledWith(
      "senha-correta",
      expect.stringMatching(/^\$2[aby]\$/),
    );
  });

  it("recusa senha incorreta para usuário ativo", async () => {
    mocks.findFirst.mockResolvedValue(usuarioBase);
    mocks.compare.mockResolvedValue(false);

    await expect(
      findUserByCredentials(usuarioBase.email, "senha-incorreta"),
    ).resolves.toBeNull();
  });
});
