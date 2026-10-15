import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), upsert: vi.fn(), categoriaCreate: vi.fn(), categoriaCount: vi.fn(), chamadosCount: vi.fn(), usuarioCount: vi.fn(), usuarioUpdate: vi.fn(), setorDelete: vi.fn(), transaction: vi.fn() }));
const tx = {
  setor: { findUnique: mocks.findUnique, findMany: mocks.findMany, create: mocks.create, delete: mocks.setorDelete },
  usuarios: { count: mocks.usuarioCount, updateMany: mocks.usuarioUpdate },
  chamadoCategoria: { create: mocks.categoriaCreate, count: mocks.categoriaCount }, chamados: { count: mocks.chamadosCount },
};
vi.mock("@/lib/auth-guard", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: { setor: { findUnique: mocks.findUnique, upsert: mocks.upsert }, $transaction: mocks.transaction } }));
import { criarSetor, excluirSetor } from "@/actions/gestaoSetores";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ user: { id: "1" } });
  mocks.transaction.mockImplementation(async (callback) => callback(tx));
  mocks.findUnique.mockResolvedValue(null);
  mocks.findMany.mockResolvedValue([{ nome: "TI" }]);
  mocks.create.mockResolvedValue({ id: 15, nome: "ESTOQUE" });
  mocks.chamadosCount.mockResolvedValue(0); mocks.categoriaCount.mockResolvedValue(0); mocks.usuarioCount.mockResolvedValue(2);
});
describe("integração setores e catálogo chamados", () => {
  it("impede nomes equivalentes normalizados de quebrar roteamento de equipes", async () => {
    expect(await criarSetor("T.I")).toMatchObject({ success: false });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("provisiona categorias do setor futuro na mesma transação", async () => {
    expect(await criarSetor("Estoque")).toMatchObject({ success: true });
    expect(mocks.categoriaCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ setorId: 15, nome: "Outros do setor", nomeNormalizado: "OUTROSDOSETOR" }) }));
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
  });
  it("protege TI e vínculos de chamados sem mover pessoas", async () => {
    mocks.findUnique.mockResolvedValue({ id: 14, nome: "T.I", protegido: false });
    expect(await excluirSetor(14)).toMatchObject({ success: false });
    expect(mocks.transaction).not.toHaveBeenCalled();
    mocks.findUnique.mockResolvedValue({ id: 15, nome: "ESTOQUE", protegido: false });
    mocks.chamadosCount.mockResolvedValue(1);
    expect(await excluirSetor(15)).toMatchObject({ success: false });
    expect(mocks.usuarioUpdate).not.toHaveBeenCalled();
    expect(mocks.setorDelete).not.toHaveBeenCalled();
  });
  it("vínculo concorrente falha dentro da transação que também move colaboradores", async () => {
    mocks.findUnique.mockResolvedValue({ id: 15, nome: "ESTOQUE", protegido: false });
    mocks.setorDelete.mockRejectedValueOnce(new Error("FK Restrict"));
    await expect(excluirSetor(15)).rejects.toThrow("FK Restrict");
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(mocks.usuarioUpdate).toHaveBeenCalledOnce(); // Efeito permanece transacional, não confirmado antes do delete.
  });
});
