import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  blueprintMember: { findUnique: vi.fn() },
  blueprintProject: { findUnique: vi.fn(), update: vi.fn() },
  blueprintActivity: { create: vi.fn() },
  $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(prismaMock)),
}));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("../../auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "1", role: "User" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { MoverProjetoBlueprint } from "@/actions/BlueprintProjects";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.blueprintMember.findUnique.mockResolvedValue({ role: "PROPRIETARIO" });
  prismaMock.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(prismaMock));
});

describe("MoverProjetoBlueprint — transições de status", () => {
  it("permite avançar de IDEA para PRONTO_ESPECIFICACAO", async () => {
    prismaMock.blueprintProject.findUnique.mockResolvedValueOnce({ status: "IDEA" });
    const res = await MoverProjetoBlueprint({ projectId: "clx123456789012345678901234", novoStatus: "PRONTO_ESPECIFICACAO" });
    expect(res.success).toBe(true);
  });

  it("rejeita pular direto de IDEA para CONCLUIDO", async () => {
    prismaMock.blueprintProject.findUnique.mockResolvedValueOnce({ status: "IDEA" });
    const res = await MoverProjetoBlueprint({ projectId: "clx123456789012345678901234", novoStatus: "CONCLUIDO" });
    expect(res.success).toBe(false);
    expect(prismaMock.blueprintProject.update).not.toHaveBeenCalled();
  });

  it("permite voltar de EM_ESPECIFICACAO para PRONTO_ESPECIFICACAO (retrocesso controlado)", async () => {
    prismaMock.blueprintProject.findUnique.mockResolvedValueOnce({ status: "EM_ESPECIFICACAO" });
    const res = await MoverProjetoBlueprint({ projectId: "clx123456789012345678901234", novoStatus: "PRONTO_ESPECIFICACAO" });
    expect(res.success).toBe(true);
  });

  it("qualquer status pode ir para ARQUIVADO", async () => {
    prismaMock.blueprintProject.findUnique.mockResolvedValueOnce({ status: "EM_DESENVOLVIMENTO" });
    const res = await MoverProjetoBlueprint({ projectId: "clx123456789012345678901234", novoStatus: "ARQUIVADO" });
    expect(res.success).toBe(true);
  });

  it("mover para o mesmo status atual é idempotente (não erro, mas não regrava)", async () => {
    prismaMock.blueprintProject.findUnique.mockResolvedValueOnce({ status: "EM_REVISAO" });
    const res = await MoverProjetoBlueprint({ projectId: "clx123456789012345678901234", novoStatus: "EM_REVISAO" });
    expect(res.success).toBe(true);
    expect(prismaMock.blueprintProject.update).not.toHaveBeenCalled();
  });

  it("projeto inexistente retorna erro claro", async () => {
    prismaMock.blueprintProject.findUnique.mockResolvedValueOnce(null);
    const res = await MoverProjetoBlueprint({ projectId: "clx123456789012345678901234", novoStatus: "IDEA" });
    expect(res.success).toBe(false);
    expect(typeof res.error === "string" && res.error).toMatch(/não encontrado/i);
  });

  it("usuário sem acesso ao projeto é bloqueado antes de tocar no banco", async () => {
    prismaMock.blueprintMember.findUnique.mockResolvedValueOnce(null);
    const res = await MoverProjetoBlueprint({ projectId: "clx123456789012345678901234", novoStatus: "IDEA" });
    expect(res.success).toBe(false);
    expect(prismaMock.blueprintProject.findUnique).not.toHaveBeenCalled();
  });
});
