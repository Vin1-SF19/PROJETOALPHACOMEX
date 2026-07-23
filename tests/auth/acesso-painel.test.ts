import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  usuarios: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import {
  bloquearTokenAcesso,
  revalidarTokenAcesso,
  statusPermiteAcessoPainel,
  usuarioPodeAcessarPainel,
} from "@/lib/auth/acesso-painel";

describe("política de acesso ao Painel Alpha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aceita somente o status ATIVO", () => {
    expect(statusPermiteAcessoPainel("ATIVO")).toBe(true);

    for (const status of ["INATIVO", "AFASTADO", "FÉRIAS", "FERIAS", "", null]) {
      expect(statusPermiteAcessoPainel(status)).toBe(false);
    }
  });

  it("consulta o estado atual do usuário pelo id", async () => {
    prismaMock.usuarios.findUnique.mockResolvedValue({ status: "ATIVO" });

    await expect(usuarioPodeAcessarPainel("42")).resolves.toBe(true);
    expect(prismaMock.usuarios.findUnique).toHaveBeenCalledWith({
      where: { id: 42 },
      select: { status: true },
    });
  });

  it.each(["INATIVO", "AFASTADO", "FÉRIAS", "FERIAS"])(
    "nega o status não ativo %s",
    async (status) => {
      prismaMock.usuarios.findUnique.mockResolvedValue({ status });

      await expect(usuarioPodeAcessarPainel(7)).resolves.toBe(false);
    },
  );

  it("nega identificador inválido sem consultar o banco", async () => {
    await expect(usuarioPodeAcessarPainel("inválido")).resolves.toBe(false);
    expect(prismaMock.usuarios.findUnique).not.toHaveBeenCalled();
  });

  it("nega quando o usuário não existe", async () => {
    prismaMock.usuarios.findUnique.mockResolvedValue(null);

    await expect(usuarioPodeAcessarPainel(7)).resolves.toBe(false);
  });

  it("falha de forma segura quando o banco não pode validar o status", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    prismaMock.usuarios.findUnique.mockRejectedValue(new Error("database unavailable"));

    await expect(usuarioPodeAcessarPainel(7)).resolves.toBe(false);
    expect(consoleError).toHaveBeenCalledOnce();

    consoleError.mockRestore();
  });

  it("mantém um JWT ativo quando o banco ainda confirma ATIVO", async () => {
    prismaMock.usuarios.findUnique.mockResolvedValue({ status: "ATIVO" });

    await expect(
      revalidarTokenAcesso({ id: "7", email: "ativo@alpha.test", role: "User" }),
    ).resolves.toMatchObject({
      id: "7",
      email: "ativo@alpha.test",
      role: "User",
      acessoBloqueado: false,
      statusUsuario: "ATIVO",
    });
  });

  it("invalida a identidade de um JWT emitido antes do bloqueio", async () => {
    prismaMock.usuarios.findUnique.mockResolvedValue({ status: "INATIVO" });

    const token = await revalidarTokenAcesso({
      sub: "7",
      id: "7",
      email: "bloqueado@alpha.test",
      nome: "Usuário",
      role: "Admin",
      permissoes: ["admin"],
    });

    expect(token).toMatchObject({ acessoBloqueado: true });
    expect(token.id).toBeUndefined();
    expect(token.sub).toBeUndefined();
    expect(token.email).toBeUndefined();
    expect(token.role).toBeUndefined();
    expect(token.permissoes).toBeUndefined();
  });

  it("mantém bloqueado um token já invalidado sem nova consulta", async () => {
    const token = bloquearTokenAcesso({ id: "7", acessoBloqueado: false });

    await expect(revalidarTokenAcesso(token)).resolves.toMatchObject({
      acessoBloqueado: true,
      id: undefined,
    });
    expect(prismaMock.usuarios.findUnique).not.toHaveBeenCalled();
  });
});
