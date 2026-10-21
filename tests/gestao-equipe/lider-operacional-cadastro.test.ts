import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  admin: vi.fn(), encontrar: vi.fn(), listar: vi.fn(), criar: vi.fn(), categoria: vi.fn(),
  transacao: vi.fn(), upsert: vi.fn(), usuario: vi.fn(), permissoes: vi.fn(), overrides: vi.fn(),
}));
vi.mock("@/lib/auth-guard", () => ({ requireAdmin: m.admin }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: {
  setor: { findUnique: m.encontrar, findMany: m.listar, upsert: m.upsert },
  usuarios: { findUnique: m.usuario }, setorPermissao: { findMany: m.permissoes },
  usuarioPermissaoOverride: { findMany: m.overrides },
  $transaction: m.transacao,
} }));
import { criarSetor, getSetoresParaSelect } from "@/actions/gestaoSetores";
import { cadastrarSetor } from "@/lib/setores/cadastro";
import { readEffectiveModulePermissions } from "@/lib/permissions/effective";
import { LinkExternoSchema } from "@/lib/validations/link-externo";
import { isAdminRole, isParceirosAdminRole } from "@/lib/roles";

beforeEach(() => {
  vi.resetAllMocks();
  m.admin.mockResolvedValue({ user: { id: "1", role: "Admin" } });
  m.encontrar.mockResolvedValue(null);
  m.listar.mockResolvedValue([{ nome: "Lider Comercial" }, { nome: "OPERACIONAL" }]);
  m.criar.mockResolvedValue({ id: 20, nome: "Lider Operacional" });
  m.transacao.mockImplementation(async (executar) => executar({
    setor: { findMany: m.listar, create: m.criar }, chamadoCategoria: { create: m.categoria },
  }));
  m.usuario.mockResolvedValue({ role: "Lider Operacional", permissoes: "" });
  m.permissoes.mockResolvedValue([]);
  m.overrides.mockResolvedValue([]);
});

describe("cadastro explícito de Lider Operacional", () => {
  it("admin cria um setor canônico e apenas sua categoria padrão, atomicamente", async () => {
    expect(await criarSetor("LÍDER OPERACIONAL")).toEqual({ success: true, message: "Setor criado" });
    expect(m.admin).toHaveBeenCalledOnce();
    expect(m.criar).toHaveBeenCalledWith({ data: { nome: "Lider Operacional" } });
    expect(m.categoria).toHaveBeenCalledOnce();
    expect(m.categoria).toHaveBeenCalledWith({ data: expect.objectContaining({
      setorId: 20, nome: "Outros do setor", nomeNormalizado: "OUTROSDOSETOR",
    }) });
    expect(m.transacao).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });

  it("não duplica, renomeia ou reativa um alias já existente", async () => {
    m.listar.mockResolvedValue([{ nome: "LÍDER OPERACIONAL", ativo: false }]);
    expect(await cadastrarSetor("Lider Operacional")).toMatchObject({ success: false });
    expect(m.criar).not.toHaveBeenCalled();
    expect(m.categoria).not.toHaveBeenCalled();
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it("repetição exata não cria outro setor ou categoria", async () => {
    await cadastrarSetor("Lider Operacional");
    m.encontrar.mockResolvedValue({ id: 20, nome: "Lider Operacional" });
    expect(await cadastrarSetor("Lider Operacional")).toMatchObject({ success: false });
    expect(m.criar).toHaveBeenCalledOnce();
    expect(m.categoria).toHaveBeenCalledOnce();
  });

  it("nega cadastro pela action antes de qualquer consulta ou escrita sem admin", async () => {
    m.admin.mockRejectedValue(new Error("Não autorizado"));
    await expect(criarSetor("Lider Operacional")).rejects.toThrow("Não autorizado");
    expect(m.encontrar).not.toHaveBeenCalled();
    expect(m.transacao).not.toHaveBeenCalled();
  });

  it("setor cadastrado participa das listas sem virar seed automático em leitura", async () => {
    m.listar.mockResolvedValue([{ nome: "Lider Comercial" }, { nome: "Lider Operacional" }]);
    expect(await getSetoresParaSelect()).toEqual(["Lider Comercial", "Lider Operacional"]);
    expect(m.upsert.mock.calls.some(([arg]) => arg.where.nome === "Lider Operacional")).toBe(false);
  });

  it("recebe somente permissões configuradas e overrides, sem privilégios comerciais", async () => {
    expect(await readEffectiveModulePermissions(20)).toEqual([]);
    expect(m.permissoes).toHaveBeenCalledWith({ where: { setor: "Lider Operacional" }, select: { modulo: true } });
    m.permissoes.mockResolvedValue([{ modulo: "crm" }, { modulo: "schools" }]);
    m.overrides.mockResolvedValue([{ modulo: "schools", acao: "REMOVE" }, { modulo: "chamados", acao: "ADD" }]);
    expect(await readEffectiveModulePermissions(20)).toEqual(["crm", "chamados"]);
    expect(isAdminRole("Lider Operacional")).toBe(false);
    expect(isParceirosAdminRole("Lider Operacional")).toBe(false);
  });

  it("permite configurar visibilidade de links para o setor canônico", () => {
    expect(LinkExternoSchema.safeParse({ label: "Painel externo", url: "https://alpha.test", iconName: "Link", visivelPara: "Lider Operacional" }).success).toBe(true);
  });
});
