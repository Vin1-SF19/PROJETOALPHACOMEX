import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findUnique: vi.fn(),
  permissoes: vi.fn(),
  auditoria: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({
  default: { usuarios: { findUnique: mocks.findUnique }, auditoria: { create: mocks.auditoria } },
}));
vi.mock("@/actions/PermissoesSetor", () => ({ getPermissoesEfetivas: mocks.permissoes }));

import { verificarAcessoMesclagem } from "@/lib/mesclagem/autorizacao";

describe("Autorização da Mesclagem", () => {
  beforeEach(() => vi.clearAllMocks());

  it("nega sessão ausente", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(verificarAcessoMesclagem()).resolves.toMatchObject({ autorizado: false, status: 401 });
  });

  it("autoriza admin ativo sem exigir permissão redundante", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "1" } });
    mocks.findUnique.mockResolvedValue({ role: "Admin", status: "ATIVO" });
    await expect(verificarAcessoMesclagem()).resolves.toEqual({ autorizado: true, userId: 1 });
    expect(mocks.permissoes).not.toHaveBeenCalled();
  });

  it("autoriza usuário ativo com permissão efetiva", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "2" } });
    mocks.findUnique.mockResolvedValue({ role: "Comercial", status: "ATIVO" });
    mocks.permissoes.mockResolvedValue(["mesclagemPlanilhas"]);
    await expect(verificarAcessoMesclagem()).resolves.toEqual({ autorizado: true, userId: 2 });
  });

  it("nega usuário inativo mesmo com papel administrativo", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "3" } });
    mocks.findUnique.mockResolvedValue({ role: "Admin", status: "INATIVO" });
    await expect(verificarAcessoMesclagem()).resolves.toMatchObject({ autorizado: false, status: 403 });
  });
});
