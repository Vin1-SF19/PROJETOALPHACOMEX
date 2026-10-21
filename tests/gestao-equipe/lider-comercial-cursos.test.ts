import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ auth: vi.fn(), criar: vi.fn(), editar: vi.fn(), apagar: vi.fn(), cursos: vi.fn() }));
vi.mock("../../auth", () => ({ auth: m.auth }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: {
  curso: { create: m.criar, update: m.editar, findMany: m.cursos },
  cursoSetor: { deleteMany: m.apagar }, cursoModulo: { deleteMany: m.apagar },
} }));
import { criarCurso, editarCurso, getCursosPorSetor, listarSetoresDistintos } from "@/actions/Cursos";

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ user: { id: "1", role: "Admin" } });
  m.criar.mockResolvedValue({ id: "curso-1" });
  m.cursos.mockResolvedValue([]);
});

describe("conteúdo Alpha Skills destinado ao Lider Comercial", () => {
  it("inclui o destino e preserva todos os rótulos legados", async () => {
    expect(await listarSetoresDistintos()).toEqual([
      "T.I", "Comercial", "Lider Comercial", "Operacional", "Financeiro", "Recursos-Humanos", "Serviços Gerais",
    ]);
  });

  it("cria, edita e consulta curso destinado somente ao novo setor", async () => {
    const payload = { nome: "Formação liderança", setores: ["Lider Comercial"] };
    expect(await criarCurso(payload)).toEqual({ success: true, id: "curso-1" });
    expect(m.criar).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ setores: { create: [{ setor: "Lider Comercial" }] } }),
    }));
    expect(await editarCurso({ id: "curso-1", ...payload })).toEqual({ success: true });
    expect(m.editar).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ setores: { createMany: { data: [{ setor: "Lider Comercial" }] } } }),
    }));
    await getCursosPorSetor("Lider Comercial");
    expect(m.cursos).toHaveBeenCalledWith(expect.objectContaining({
      where: { setores: { some: { setor: "Lider Comercial" } } },
    }));
  });

  it("não concede gerenciamento de cursos ao setor de destino", async () => {
    m.auth.mockResolvedValue({ user: { id: "7", role: "Lider Comercial" } });
    const payload = { nome: "Curso", setores: ["Lider Comercial"] };
    expect(await criarCurso(payload)).toEqual({ success: false, error: "Sem permissão" });
    expect(await editarCurso({ id: "curso-1", ...payload })).toEqual({ success: false, error: "Sem permissão" });
    expect(m.criar).not.toHaveBeenCalled();
    expect(m.editar).not.toHaveBeenCalled();
    expect(m.apagar).not.toHaveBeenCalled();
  });
});
