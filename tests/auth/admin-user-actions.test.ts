import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  updateUser: vi.fn(),
  findUser: vi.fn(),
  createUser: vi.fn(),
  findSectorPermissions: vi.fn(),
  updateColaborador: vi.fn(),
  hash: vi.fn(),
}));

vi.mock("@/lib/auth-guard", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("bcryptjs", () => ({ hash: mocks.hash }));
vi.mock("@/lib/prisma", () => ({
  default: {
    usuarios: {
      update: mocks.updateUser,
      findFirst: mocks.findUser,
      create: mocks.createUser,
    },
    setorPermissao: { findMany: mocks.findSectorPermissions },
    colaboradores_core: { update: mocks.updateColaborador },
  },
}));

import { atualizarAgenteSistemaAction } from "@/actions/colaboradores";
import { updateUser } from "@/actions/manage-user";
import registerAction from "@/actions/CreateAction";

function userForm(): FormData {
  const form = new FormData();
  form.set("nome", "Usuário Teste");
  form.set("usuario", "usuario.teste");
  form.set("email", "USUARIO@ALPHA.TEST");
  form.set("role", "User");
  form.append("permissoes", "agenda");
  return form;
}

describe("autorização das actions administrativas de usuário", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ user: { id: "1", role: "Admin" } });
    mocks.updateUser.mockResolvedValue({ id: 7 });
    mocks.findUser.mockResolvedValue(null);
    mocks.createUser.mockResolvedValue({
      id: 8,
      nome: "Usuário Novo",
      usuario: "usuario.novo",
      email: "novo@alpha.test",
      role: "User",
      telefone: null,
      telefone_corporativo: null,
    });
    mocks.findSectorPermissions.mockResolvedValue([]);
    mocks.hash.mockResolvedValue("bcrypt-hash");
  });

  it("revoga as sessões do alvo quando um admin substitui a senha", async () => {
    const form = userForm();
    form.set("senha", "uma frase longa e segura");

    await expect(updateUser("7", form)).resolves.toEqual({ success: true });
    expect(mocks.updateUser).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        senha: "bcrypt-hash",
        authSessionVersion: { increment: 1 },
      }),
    }));
  });

  it("bloqueia updateUser antes de interpretar ou gravar o payload", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("NOT_AUTHENTICATED"));

    await expect(updateUser("7", userForm())).resolves.toMatchObject({ success: false });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("normaliza dados válidos somente depois da autorização", async () => {
    await expect(updateUser("7", userForm())).resolves.toEqual({ success: true });

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.updateUser).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        nome: "Usuário Teste",
        usuario: "usuario.teste",
        email: "usuario@alpha.test",
        role: "User",
        permissoes: "agenda",
        authSessionVersion: { increment: 1 },
      },
    });
  });

  it("não aplica role ou status padrão quando o payload do Alpha Vault está incompleto", async () => {
    const form = new FormData();
    form.set("id", "7");
    form.set("cargo", "AGENTE ALPHA");

    await expect(atualizarAgenteSistemaAction(form)).resolves.toEqual({
      success: false,
      error: "DADOS INVÁLIDOS",
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("bloqueia a alteração do Alpha Vault sem admin", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("NOT_AUTHENTICATED"));
    const form = new FormData();
    form.set("id", "7");
    form.set("cargo", "AGENTE ALPHA");
    form.set("data", "2026-09-19");
    form.set("status", "ATIVO");
    form.set("setor", "COMERCIAL");

    await expect(atualizarAgenteSistemaAction(form)).resolves.toMatchObject({ success: false });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("aplica a política forte também ao provisionar um usuário", async () => {
    const form = new FormData();
    form.set("nome", "Usuário Novo");
    form.set("usuario", "usuario.novo");
    form.set("email", "NOVO@ALPHA.TEST");
    form.set("role", "User");
    form.set("senha", "uma frase longa e segura");

    await expect(registerAction(null, form)).resolves.toMatchObject({ success: true });
    expect(mocks.hash).toHaveBeenCalledWith("uma frase longa e segura", 12);
    expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: "novo@alpha.test",
        senha: "bcrypt-hash",
        senhaTemporaria: true,
      }),
    }));
  });

  it("rejeita senha inicial fraca antes de consultar ou gravar usuário", async () => {
    const form = new FormData();
    form.set("nome", "Usuário Novo");
    form.set("usuario", "usuario.novo");
    form.set("email", "novo@alpha.test");
    form.set("role", "User");
    form.set("senha", "curta");

    await expect(registerAction(null, form)).resolves.toMatchObject({ success: false });
    expect(mocks.findUser).not.toHaveBeenCalled();
    expect(mocks.createUser).not.toHaveBeenCalled();
  });
});
