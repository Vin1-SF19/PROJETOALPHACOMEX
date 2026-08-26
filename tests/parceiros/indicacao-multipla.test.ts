import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  indicacao: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  parceiro: { update: vi.fn() },
  parceiroAcesso: { findUnique: vi.fn() },
}));
const authMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const sincronizarEstagioMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/parceiros/desenvolvimento", () => ({ sincronizarEstagioAposIndicacao: sincronizarEstagioMock }));

import { criarIndicacao } from "@/actions/parceiros";

describe("Fase 08 — regressão: criarIndicacao permite múltiplas indicações por empresa ao longo do tempo (migration Fase 01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Role "Admin" — evita a checagem adicional em `ParceiroAcesso` (não é o foco deste teste).
    authMock.mockResolvedValue({ user: { id: "7", role: "Admin" } });
    prismaMock.parceiroAcesso.findUnique.mockResolvedValue(null);
    prismaMock.indicacao.findMany.mockResolvedValue([]); // recalcularNivel
    sincronizarEstagioMock.mockResolvedValue({ alterado: false });
  });

  it("cria a 1ª indicação de uma empresa que nunca foi indicada", async () => {
    prismaMock.indicacao.findFirst.mockResolvedValue(null);
    prismaMock.indicacao.create.mockResolvedValue({ id: 1 });
    const r = await criarIndicacao(10, 500);
    expect(r.success).toBe(true);
    expect(prismaMock.indicacao.create).toHaveBeenCalledWith({ data: { parceiroId: 10, clienteId: 500, criadoPorId: 7 } });
  });

  it("rejeita quando a empresa já tem uma indicação ATIVA no momento (regra preservada)", async () => {
    prismaMock.indicacao.findFirst.mockResolvedValue({ id: 1, status: "ATIVA" });
    const r = await criarIndicacao(11, 500);
    expect(r.success).toBe(false);
    expect(prismaMock.indicacao.create).not.toHaveBeenCalled();
  });

  it("permite uma NOVA indicação para uma empresa que já teve indicação anterior DESVINCULADA — comportamento que a constraint @unique antiga impedia", async () => {
    // findFirst filtra por status:"ATIVA" — uma DESVINCULADA nunca é retornada aqui, então o
    // fluxo segue para criar uma nova linha (não reescreve a antiga).
    prismaMock.indicacao.findFirst.mockResolvedValue(null);
    prismaMock.indicacao.create.mockResolvedValue({ id: 2 });
    const r = await criarIndicacao(12, 500); // mesmo clienteId 500 de antes, novo parceiro/indicação
    expect(r.success).toBe(true);
    expect(prismaMock.indicacao.create).toHaveBeenCalledWith({ data: { parceiroId: 12, clienteId: 500, criadoPorId: 7 } });
  });

  it("dispara a automação de estágio (Fase 03) após criar a indicação", async () => {
    prismaMock.indicacao.findFirst.mockResolvedValue(null);
    prismaMock.indicacao.create.mockResolvedValue({ id: 3 });
    await criarIndicacao(13, 501);
    expect(sincronizarEstagioMock).toHaveBeenCalledWith(13, { usuarioId: 7 });
  });
});
