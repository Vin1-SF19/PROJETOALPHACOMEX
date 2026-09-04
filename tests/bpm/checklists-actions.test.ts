import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const acessoConfigMock = vi.hoisted(() => vi.fn());
const revalidateMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  bpmChecklistTemplate: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  bpmChecklistTemplateItem: { create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  bpmPipeline: { findUnique: vi.fn(), findMany: vi.fn() },
  bpmEtapa: { findUnique: vi.fn() },
  bpmCard: { findUnique: vi.fn(), findMany: vi.fn() },
  servicosComerciais: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidateMock }));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoConfigPipeline: acessoConfigMock, exigirAcessoBpmCard: vi.fn() }));
vi.mock("@/lib/bpm/checklists/service", () => ({ materializarChecklistsAplicaveisCard: vi.fn(), carregarResumoChecklistCard: vi.fn() }));
vi.mock("@/lib/bpm/historico-server", () => ({ registrarHistoricoCard: vi.fn() }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: vi.fn() }));

import { CriarTemplateChecklistBpm, ListarTemplatesChecklistBpm, ListarWorkspaceChecklistsBpm, SalvarTemplateChecklistBpm } from "@/actions/bpm/Checklists";

describe("Checklists.ts — Server Actions administrativas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "7", role: "Admin" } });
    acessoConfigMock.mockResolvedValue(undefined);
    prismaMock.$transaction.mockImplementation(async (operacao) => operacao(prismaMock));
  });

  it("autentica antes de listar", async () => {
    authMock.mockResolvedValue(null);
    const resposta = await ListarTemplatesChecklistBpm();
    expect(resposta).toEqual({ success: false, error: "Não autorizado", data: [] });
    expect(prismaMock.bpmChecklistTemplate.findMany).not.toHaveBeenCalled();
  });

  it("valida payload com Zod antes de persistir", async () => {
    const resposta = await CriarTemplateChecklistBpm({ nome: "" });
    expect(resposta).toEqual({ success: false, error: "Dados inválidos" });
    expect(prismaMock.bpmChecklistTemplate.create).not.toHaveBeenCalled();
  });

  it("cria template com itens e identidade do administrador", async () => {
    prismaMock.bpmChecklistTemplate.create.mockResolvedValue({ id: "cm12345678901234567890123" });
    const resposta = await CriarTemplateChecklistBpm({
      nome: "Documentação", ativo: true,
      itens: [{ nome: "Contrato", obrigatorio: true, ordem: 0 }],
    });
    expect(resposta).toEqual({ success: true, data: { id: "cm12345678901234567890123" } });
    expect(acessoConfigMock).toHaveBeenCalledWith(7, "configurarChecklists");
    expect(prismaMock.bpmChecklistTemplate.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ nome: "Documentação", criadoPorId: 7, itens: { create: [expect.objectContaining({ nome: "Contrato", ordem: 0 })] } }),
      select: { id: true },
    }));
    expect(revalidateMock).toHaveBeenCalledWith("/PainelAlpha/AlphaCRM/admin/checklists");
  });

  it("carrega as fontes controladas do builder em uma leitura administrativa", async () => {
    prismaMock.bpmChecklistTemplate.findMany.mockResolvedValue([]);
    prismaMock.bpmPipeline.findMany.mockResolvedValue([{ id: "pipeline-1", nome: "Comercial", etapas: [] }]);
    prismaMock.servicosComerciais.findMany.mockResolvedValue([{ nome: "Radar" }]);
    prismaMock.bpmCard.findMany.mockResolvedValue([]);

    const resposta = await ListarWorkspaceChecklistsBpm();

    expect(resposta).toMatchObject({ success: true, data: { servicos: ["Radar"], cards: [] } });
    expect(acessoConfigMock).toHaveBeenCalledWith(7, "configurarChecklists");
    expect(prismaMock.bpmPipeline.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ativo: true } }));
  });

  it("reconcilia metadados, remoções, edições e novos itens atomicamente", async () => {
    const templateId = "cm12345678901234567890123";
    const itemMantidoId = "cm12345678901234567890124";
    const itemRemovidoId = "cm12345678901234567890125";
    prismaMock.bpmChecklistTemplate.findUnique.mockResolvedValue({
      id: templateId,
      itens: [{ id: itemMantidoId }, { id: itemRemovidoId }],
    });
    prismaMock.bpmChecklistTemplate.update.mockResolvedValue({ id: templateId });
    prismaMock.bpmChecklistTemplateItem.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.bpmChecklistTemplateItem.update.mockResolvedValue({ id: itemMantidoId });
    prismaMock.bpmChecklistTemplateItem.create.mockResolvedValue({ id: "cm12345678901234567890126" });

    const resposta = await SalvarTemplateChecklistBpm({
      id: templateId,
      nome: "Documentação atualizada",
      ativo: true,
      itens: [
        { id: itemMantidoId, nome: "Contrato", obrigatorio: true, ordem: 8 },
        { nome: "Procuração", obrigatorio: false, ordem: 9 },
      ],
    });

    expect(resposta).toEqual({ success: true });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.bpmChecklistTemplateItem.deleteMany).toHaveBeenCalledWith({
      where: { templateId, id: { notIn: [itemMantidoId] } },
    });
    expect(prismaMock.bpmChecklistTemplateItem.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: itemMantidoId },
      data: expect.objectContaining({ nome: "Contrato", ordem: 0 }),
    }));
    expect(prismaMock.bpmChecklistTemplateItem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ templateId, nome: "Procuração", ordem: 1 }),
    }));
  });
});
