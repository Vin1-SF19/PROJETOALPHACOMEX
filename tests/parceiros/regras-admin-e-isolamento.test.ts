import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  parceiroConfig: { upsert: vi.fn() },
  parceiroAcesso: { findUnique: vi.fn() },
  parceiro: { findUnique: vi.fn(), update: vi.fn() },
  parceiroHistorico: { create: vi.fn() },
  $transaction: vi.fn(),
}));

// `convites-parceiro.ts` tem seu PRÓPRIO `getCtx()` local que chama `auth()` diretamente
// (não reaproveita o `getCtx` exportado de `parceiros.ts`) — por isso o mock de sessão real é
// necessário aqui, além do mock de `@/actions/parceiros` usado pelas Actions de Desenvolvimento.
const authMock = vi.hoisted(() => vi.fn());
const getCtxParceirosMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("@/actions/parceiros", () => ({ getCtx: getCtxParceirosMock, criarParceiro: vi.fn() }));

import { AtualizarRegrasParceiros } from "@/actions/convites-parceiro";
import { AtualizarPotencialRecorrenciaParceiro } from "@/actions/parceiros-desenvolvimento";

const CTX_EDITOR_NAO_ADMIN = { userId: 2, role: "User", isAdmin: false, podeEditar: true, podeExcluir: false, podeAprovar: false };

describe("Fase 06 — RBAC: alterar configurações exige Admin, não apenas podeEditar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.parceiroConfig.upsert.mockResolvedValue({});
    prismaMock.parceiroAcesso.findUnique.mockResolvedValue(null);
  });

  it("rejeita editor comum (role não-admin, mesmo com ParceiroAcesso.podeEditar=true)", async () => {
    authMock.mockResolvedValue({ user: { id: "2", role: "User" } });
    const r = await AtualizarRegrasParceiros({ diasAlertaSemIndicacao: 30, diasInatividade: 60, cadenciaPotencial4Dias: null, cadenciaPotencial5Dias: null, gerarTarefaAutomaticaAlertas: false });
    expect(r.success).toBe(false);
    expect(prismaMock.parceiroConfig.upsert).not.toHaveBeenCalled();
  });

  it("aceita Admin", async () => {
    authMock.mockResolvedValue({ user: { id: "1", role: "Admin" } });
    const r = await AtualizarRegrasParceiros({ diasAlertaSemIndicacao: 30, diasInatividade: 60, cadenciaPotencial4Dias: null, cadenciaPotencial5Dias: null, gerarTarefaAutomaticaAlertas: false });
    expect(r.success).toBe(true);
    expect(prismaMock.parceiroConfig.upsert).toHaveBeenCalled();
  });

  it("editor comum PODE alterar o potencial de recorrência do parceiro (ação operacional distinta de configuração)", async () => {
    getCtxParceirosMock.mockResolvedValue(CTX_EDITOR_NAO_ADMIN);
    prismaMock.parceiro.findUnique.mockResolvedValue({ potencialRecorrencia: null });
    prismaMock.$transaction.mockResolvedValue([{}, {}]);
    const r = await AtualizarPotencialRecorrenciaParceiro({ parceiroId: 1, potencialRecorrencia: 3 });
    expect(r.success).toBe(true);
  });
});

describe("Fase 06 — Isolamento Comissão × Relacionamento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCtxParceirosMock.mockResolvedValue(CTX_EDITOR_NAO_ADMIN);
    prismaMock.parceiro.findUnique.mockResolvedValue({ potencialRecorrencia: null });
    prismaMock.$transaction.mockResolvedValue([{}, {}]);
  });

  it("AtualizarPotencialRecorrenciaParceiro nunca inclui comissaoPercentual no update", async () => {
    await AtualizarPotencialRecorrenciaParceiro({ parceiroId: 1, potencialRecorrencia: 5 });
    expect(prismaMock.parceiro.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ comissaoPercentual: expect.anything() }),
      }),
    );
  });
});
