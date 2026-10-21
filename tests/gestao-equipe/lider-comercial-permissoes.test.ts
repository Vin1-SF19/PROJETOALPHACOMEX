import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  auth: vi.fn(), usuario: vi.fn(), setores: vi.fn(), upsertSetor: vi.fn(),
  permissoes: vi.fn(), overrides: vi.fn(), apagar: vi.fn(), criar: vi.fn(),
  transacao: vi.fn(), contar: vi.fn(),
}));
vi.mock("../../auth", () => ({ auth: m.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth-guard", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: {
  usuarios: { findUnique: m.usuario, count: m.contar },
  setor: { findMany: m.setores, upsert: m.upsertSetor },
  setorPermissao: { findMany: m.permissoes, deleteMany: m.apagar, createMany: m.criar },
  usuarioPermissaoOverride: { findMany: m.overrides },
  $transaction: m.transacao,
} }));

import { getSetoresParaSelect } from "@/actions/gestaoSetores";
import { atribuirModulosAoSetor, listarPermissoesPorSetor } from "@/actions/PermissoesSetor";
import { readEffectiveModulePermissions } from "@/lib/permissions/effective";
import { isAdminRole } from "@/lib/roles";

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ user: { id: "1", role: "Admin" } });
  m.usuario.mockResolvedValue({ role: "Lider Comercial", permissoes: "holerites" });
  m.setores.mockResolvedValue([{ nome: "COMERCIAL" }, { nome: "Lider Comercial" }, { nome: "Novo setor" }]);
  m.permissoes.mockResolvedValue([{ modulo: "crm" }, { modulo: "leads" }]);
  m.overrides.mockResolvedValue([{ modulo: "leads", acao: "REMOVE" }, { modulo: "schools", acao: "ADD" }]);
  m.contar.mockResolvedValue(2);
});

describe("Lider Comercial nos contratos de catálogo e permissões", () => {
  it("mantém o setor no catálogo consumido por cadastro e gestão de acessos", async () => {
    expect(await getSetoresParaSelect()).toEqual(["COMERCIAL", "Lider Comercial", "Novo setor"]);
    expect(m.upsertSetor).toHaveBeenCalledWith(expect.objectContaining({
      where: { nome: "Lider Comercial" }, update: {},
      create: { nome: "Lider Comercial", protegido: false, isBase: false },
    }));
  });

  it("admin configura e reabre permissões pela mesma identidade", async () => {
    expect(await atribuirModulosAoSetor({ setor: "Lider Comercial", modulos: ["crm", "leads"] }))
      .toEqual({ success: true, afetados: 2 });
    expect(m.criar).toHaveBeenCalledWith({ data: [
      { setor: "Lider Comercial", modulo: "crm" }, { setor: "Lider Comercial", modulo: "leads" },
    ] });
    expect(await listarPermissoesPorSetor("Lider Comercial")).toEqual(["crm", "leads"]);
    expect(m.permissoes).toHaveBeenCalledWith({ where: { setor: "Lider Comercial" }, select: { modulo: true } });
  });

  it("permissões efetivas respeitam setor exato, overrides e ausência de bypass", async () => {
    expect(await readEffectiveModulePermissions(7)).toEqual(["crm", "schools"]);
    expect(m.permissoes).toHaveBeenCalledWith({ where: { setor: "Lider Comercial" }, select: { modulo: true } });
    expect(isAdminRole("Lider Comercial")).toBe(false);
  });

  it.each(["Lider Comercial", "COMERCIAL"])("%s não configura permissões por conta própria", async (role) => {
    m.auth.mockResolvedValue({ user: { id: "7", role } });
    await expect(atribuirModulosAoSetor({ setor: "Lider Comercial", modulos: ["crm"] })).rejects.toThrow("Não autorizado");
    expect(m.apagar).not.toHaveBeenCalled();
    expect(m.criar).not.toHaveBeenCalled();
  });
});
