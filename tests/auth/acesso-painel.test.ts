import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  afterEach(() => vi.useRealTimers());
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
    prismaMock.usuarios.findUnique.mockResolvedValue({ status: "ATIVO", authSessionVersion: 0 });

    await expect(usuarioPodeAcessarPainel("42")).resolves.toBe(true);
    expect(prismaMock.usuarios.findUnique).toHaveBeenCalledWith({
      where: { id: 42 },
      select: { status: true, authSessionVersion: true },
    });
  });

  it("accepts an active read that takes the observed5.502s, before the12s observer", async () => {
    vi.useFakeTimers();
    prismaMock.usuarios.findUnique.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ status: "ATIVO", authSessionVersion: 0 }), 5_502)));
    const pending = usuarioPodeAcessarPainel(7);
    await vi.advanceTimersByTimeAsync(5_502);
    expect(await pending).toBe(true);
    expect(prismaMock.usuarios.findUnique).toHaveBeenCalledOnce();
  });

  it("does not retry a read without enough budget for the retry delay", async () => {
    vi.useFakeTimers();
    prismaMock.usuarios.findUnique.mockImplementation(() => new Promise((_, reject) => setTimeout(() => reject(new TypeError("fetch failed")), 11_990)));
    const rejected = expect(usuarioPodeAcessarPainel(7)).rejects.toMatchObject({ code: "AUTH_UNAVAILABLE" });
    await vi.advanceTimersByTimeAsync(11_990);
    await rejected;
    expect(prismaMock.usuarios.findUnique).toHaveBeenCalledOnce();
  });

  it.each(["INATIVO", "AFASTADO", "FÉRIAS", "FERIAS"])(
    "nega o status não ativo %s",
    async (status) => {
      prismaMock.usuarios.findUnique.mockResolvedValue({ status, authSessionVersion: 0 });

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

  it("nega temporariamente sem revogar quando o banco não pode validar o status", async () => {
    const consoleError = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    prismaMock.usuarios.findUnique.mockRejectedValue(new Error("database unavailable"));

    await expect(usuarioPodeAcessarPainel(7)).rejects.toMatchObject({ code: "AUTH_UNAVAILABLE" });
    // Repeated failures are aggregated across this runtime instance.
    expect(consoleError.mock.calls.length).toBeLessThanOrEqual(1);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("database unavailable");

    consoleError.mockRestore();
  });

  it("mantém um JWT ativo quando o banco ainda confirma ATIVO", async () => {
    prismaMock.usuarios.findUnique.mockResolvedValue({ status: "ATIVO", authSessionVersion: 0 });

    await expect(
      revalidarTokenAcesso({ id: "7", email: "ativo@alpha.test", role: "User", authSessionVersion: 0 }),
    ).resolves.toMatchObject({
      id: "7",
      email: "ativo@alpha.test",
      role: "User",
      acessoBloqueado: false,
      statusUsuario: "ATIVO",
      authSessionVersion: 0,
    });
  });

  it("invalida a identidade de um JWT emitido antes do bloqueio", async () => {
    prismaMock.usuarios.findUnique.mockResolvedValue({ status: "INATIVO", authSessionVersion: 0 });

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

  it("invalida JWT emitido antes de uma troca de senha", async () => {
    prismaMock.usuarios.findUnique.mockResolvedValue({ status: "ATIVO", authSessionVersion: 2 });

    const token = await revalidarTokenAcesso({
      id: "7",
      email: "ativo@alpha.test",
      authSessionVersion: 1,
    });

    expect(token).toMatchObject({ acessoBloqueado: true });
    expect(token.id).toBeUndefined();
    expect(token.authSessionVersion).toBeUndefined();
  });
});
