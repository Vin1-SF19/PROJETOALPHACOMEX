import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  usuarios: { findUnique: vi.fn() },
  googleCalendarConexao: { findUnique: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import { obterUsuarioGoogleAtivo } from "@/lib/google-calendar/usuario-google";

describe("obterUsuarioGoogleAtivo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna sem_conexao quando não há GoogleCalendarConexao", async () => {
    prismaMock.usuarios.findUnique.mockResolvedValueOnce({ email: "fulano@empresa.com" });
    prismaMock.googleCalendarConexao.findUnique.mockResolvedValueOnce(null);

    const resultado = await obterUsuarioGoogleAtivo(1);
    expect(resultado).toEqual({ ok: false, motivo: "sem_conexao" });
  });

  it("retorna sem_conexao quando o usuário não tem e-mail cadastrado", async () => {
    prismaMock.usuarios.findUnique.mockResolvedValueOnce(null);
    prismaMock.googleCalendarConexao.findUnique.mockResolvedValueOnce({ id: "cx1", status: "ATIVA" });

    const resultado = await obterUsuarioGoogleAtivo(1);
    expect(resultado).toEqual({ ok: false, motivo: "sem_conexao" });
  });

  it("retorna desativada quando status não é ATIVA", async () => {
    prismaMock.usuarios.findUnique.mockResolvedValueOnce({ email: "fulano@empresa.com" });
    prismaMock.googleCalendarConexao.findUnique.mockResolvedValueOnce({ id: "cx1", status: "DESATIVADA" });

    const resultado = await obterUsuarioGoogleAtivo(1);
    expect(resultado).toEqual({ ok: false, motivo: "desativada" });
  });

  it("retorna o e-mail do usuário (nunca um valor externo) quando ativo", async () => {
    prismaMock.usuarios.findUnique.mockResolvedValueOnce({ email: "fulano@empresa.com" });
    prismaMock.googleCalendarConexao.findUnique.mockResolvedValueOnce({ id: "cx1", status: "ATIVA" });

    const resultado = await obterUsuarioGoogleAtivo(1);
    expect(resultado).toEqual({ ok: true, emailUsuario: "fulano@empresa.com", conexaoId: "cx1" });
  });

  it("sempre consulta usuarios pelo userId do parâmetro — não aceita e-mail externo", async () => {
    prismaMock.usuarios.findUnique.mockResolvedValueOnce({ email: "dono-da-sessao@empresa.com" });
    prismaMock.googleCalendarConexao.findUnique.mockResolvedValueOnce({ id: "cx1", status: "ATIVA" });

    await obterUsuarioGoogleAtivo(42);

    expect(prismaMock.usuarios.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 42 } }),
    );
    expect(prismaMock.googleCalendarConexao.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 42 } }),
    );
  });
});
