import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const txMock = vi.hoisted(() => ({
  blueprintProject: { update: vi.fn() },
  blueprintActivity: { create: vi.fn() },
}));
const prismaMock = vi.hoisted(() => ({
  blueprintProject: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/blueprint/ownership", () => ({
  exigirAcessoBlueprint: vi.fn().mockResolvedValue({ autorizado: true }),
  isAdminRole: vi.fn().mockReturnValue(true),
}));

import { AtualizarProjetoBlueprint } from "@/actions/BlueprintProjects";

const projectId = "clx123456789012345678901234";

describe("AtualizarProjetoBlueprint — autorização do prêmio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback) => callback(txMock));
    txMock.blueprintActivity.create.mockResolvedValue({ id: "atividade-1" });
  });

  it("bloqueia até Admin/CEO quando não é o criador", async () => {
    authMock.mockResolvedValue({ user: { id: "1", role: "Admin" } });
    prismaMock.blueprintProject.findUnique.mockResolvedValue({
      id: projectId,
      createdById: 42,
      title: "Projeto",
      priority: "NORMAL",
      premioCents: null,
    });

    const resultado = await AtualizarProjetoBlueprint({ projectId, premioCents: 100_000 });

    expect(resultado).toEqual({
      success: false,
      error: "Apenas o criador do projeto pode alterar o prêmio",
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("permite ao criador definir o prêmio e registra a atividade", async () => {
    authMock.mockResolvedValue({ user: { id: "42", role: "User" } });
    prismaMock.blueprintProject.findUnique.mockResolvedValue({
      id: projectId,
      createdById: 42,
      title: "Projeto",
      priority: "NORMAL",
      premioCents: null,
    });
    txMock.blueprintProject.update.mockResolvedValue({
      id: projectId,
      createdById: 42,
      title: "Projeto",
      priority: "NORMAL",
      premioCents: 100_000,
    });

    const resultado = await AtualizarProjetoBlueprint({ projectId, premioCents: 100_000 });

    expect(resultado.success).toBe(true);
    expect(txMock.blueprintProject.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: projectId },
        data: expect.objectContaining({ premioCents: 100_000, updatedById: 42 }),
      }),
    );
    expect(txMock.blueprintActivity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          previousValueJson: expect.stringContaining('"premioCents":null'),
          newValueJson: expect.stringContaining('"premioCents":100000'),
        }),
      }),
    );
  });
});
