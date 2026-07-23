import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  compareSync: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    usuarios: {
      findFirst: mocks.findFirst,
    },
  },
}));

vi.mock("bcryptjs", () => ({
  compareSync: mocks.compareSync,
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
  presets: [],
};

describe("login por credenciais e status do colaborador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.compareSync.mockReturnValue(true);
  });

  it("permite credenciais corretas quando o status atual é ATIVO", async () => {
    mocks.findFirst.mockResolvedValue(usuarioBase);

    await expect(
      findUserByCredentials(usuarioBase.email, "senha-correta"),
    ).resolves.toMatchObject({
      id: "12",
      email: usuarioBase.email,
      permissoes: ["agenda", "chamados"],
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
      expect(mocks.compareSync).not.toHaveBeenCalled();
    },
  );

  it("recusa usuário inexistente sem revelar o motivo", async () => {
    mocks.findFirst.mockResolvedValue(null);

    await expect(
      findUserByCredentials("ausente@alpha.test", "senha-correta"),
    ).resolves.toBeNull();
    expect(mocks.compareSync).not.toHaveBeenCalled();
  });

  it("recusa senha incorreta para usuário ativo", async () => {
    mocks.findFirst.mockResolvedValue(usuarioBase);
    mocks.compareSync.mockReturnValue(false);

    await expect(
      findUserByCredentials(usuarioBase.email, "senha-incorreta"),
    ).resolves.toBeNull();
  });
});
