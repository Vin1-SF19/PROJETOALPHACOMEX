import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  indicacao: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  cliente: { findUnique: vi.fn() },
  parceiro: { update: vi.fn() },
  parceiroAcesso: { findUnique: vi.fn() },
  parceiroHistorico: { create: vi.fn() },
}));
const authMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());
const sincronizarEstagioMock = vi.hoisted(() => vi.fn());
const obterEtapaMock = vi.hoisted(() => vi.fn());
const direcionarAutomaticoMock = vi.hoisted(() => vi.fn());
const resolverResponsavelMock = vi.hoisted(() => vi.fn());
const criarCardBpmMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/lib/parceiros/desenvolvimento", () => ({ sincronizarEstagioAposIndicacao: sincronizarEstagioMock }));
vi.mock("@/actions/parceiros-indicacoes", () => ({
  obterEtapaNovosLeadsPipelineIndicacoes: obterEtapaMock,
  direcionarIndicacaoParaCloserAutomatico: direcionarAutomaticoMock,
}));
vi.mock("@/lib/bpm/ownership", () => ({ resolverResponsavelAutomaticoBpm: resolverResponsavelMock }));
vi.mock("@/actions/bpm/Cards", () => ({ CriarCardBpm: criarCardBpmMock }));

import { criarIndicacao } from "@/actions/parceiros";

describe("Fase 08 — regressão: criarIndicacao permite múltiplas indicações por empresa ao longo do tempo (migration Fase 01)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Role "Admin" — evita a checagem adicional em `ParceiroAcesso` (não é o foco deste teste).
    authMock.mockResolvedValue({ user: { id: "7", role: "Admin" } });
    prismaMock.parceiroAcesso.findUnique.mockResolvedValue(null);
    prismaMock.indicacao.findMany.mockResolvedValue([]); // recalcularNivel
    sincronizarEstagioMock.mockResolvedValue({ alterado: false });
    obterEtapaMock.mockResolvedValue({ pipelineId: "pipeline-1", etapaId: "etapa-1" });
    resolverResponsavelMock.mockResolvedValue(7);
    criarCardBpmMock.mockResolvedValue({ success: true, data: { id: "card-1", empresaId: 500 } });
    direcionarAutomaticoMock.mockResolvedValue(undefined);
  });

  it("cria a 1ª indicação de uma empresa que nunca foi indicada", async () => {
    prismaMock.indicacao.findFirst.mockResolvedValue(null);
    prismaMock.indicacao.create.mockResolvedValue({ id: 1 });
    const r = await criarIndicacao({ parceiroId: 10, clienteId: 500, servicoIndicado: "TTD 409" });
    expect(r.success).toBe(true);
    expect(prismaMock.indicacao.create).toHaveBeenCalledWith({
      data: { parceiroId: 10, clienteId: 500, criadoPorId: 7, servicoIndicado: "TTD 409", bpmCardId: "card-1" },
    });
  });

  it("rejeita quando a empresa já tem uma indicação ATIVA no momento (regra preservada)", async () => {
    prismaMock.indicacao.findFirst.mockResolvedValue({ id: 1, status: "ATIVA" });
    const r = await criarIndicacao({ parceiroId: 11, clienteId: 500, servicoIndicado: "TTD 409" });
    expect(r.success).toBe(false);
    expect(prismaMock.indicacao.create).not.toHaveBeenCalled();
  });

  it("permite uma NOVA indicação para uma empresa que já teve indicação anterior DESVINCULADA — comportamento que a constraint @unique antiga impedia", async () => {
    // findFirst filtra por status:"ATIVA" — uma DESVINCULADA nunca é retornada aqui, então o
    // fluxo segue para criar uma nova linha (não reescreve a antiga).
    prismaMock.indicacao.findFirst.mockResolvedValue(null);
    prismaMock.indicacao.create.mockResolvedValue({ id: 2 });
    const r = await criarIndicacao({ parceiroId: 12, clienteId: 500, servicoIndicado: "TTD 409" }); // mesmo clienteId 500 de antes, novo parceiro/indicação
    expect(r.success).toBe(true);
    expect(prismaMock.indicacao.create).toHaveBeenCalledWith({
      data: { parceiroId: 12, clienteId: 500, criadoPorId: 7, servicoIndicado: "TTD 409", bpmCardId: "card-1" },
    });
  });

  it("dispara a automação de estágio (Fase 03) após criar a indicação", async () => {
    prismaMock.indicacao.findFirst.mockResolvedValue(null);
    prismaMock.indicacao.create.mockResolvedValue({ id: 3 });
    await criarIndicacao({ parceiroId: 13, clienteId: 501, servicoIndicado: "TTD 409" });
    expect(sincronizarEstagioMock).toHaveBeenCalledWith(13, { usuarioId: 7 });
  });

  it("direciona automaticamente ao closer (cria BpmCard, sem exigir responsável no input)", async () => {
    prismaMock.indicacao.findFirst.mockResolvedValue(null);
    prismaMock.indicacao.create.mockResolvedValue({ id: 4 });
    const r = await criarIndicacao({ parceiroId: 14, clienteId: 502, servicoIndicado: "Habilitação RADAR - 50K" });
    expect(r.success).toBe(true);
    expect(resolverResponsavelMock).toHaveBeenCalledWith("pipeline-1", 7);
    expect(criarCardBpmMock).toHaveBeenCalledWith({
      empresaId: 502,
      novaEmpresa: undefined,
      pipelineId: "pipeline-1",
      etapaId: "etapa-1",
      responsavelId: 7,
      servico: "Habilitação RADAR - 50K",
    });
    expect(direcionarAutomaticoMock).toHaveBeenCalledWith({
      parceiroId: 14, bpmCardId: "card-1", responsavelId: 7, usuarioId: 7,
    });
  });

  it("rejeita quando nenhum responsável elegível é encontrado no pipeline", async () => {
    prismaMock.indicacao.findFirst.mockResolvedValue(null);
    resolverResponsavelMock.mockResolvedValue(null);
    const r = await criarIndicacao({ parceiroId: 15, clienteId: 503, servicoIndicado: "TTD 409" });
    expect(r.success).toBe(false);
    expect(criarCardBpmMock).not.toHaveBeenCalled();
    expect(prismaMock.indicacao.create).not.toHaveBeenCalled();
  });

  it("rejeita cadastrar empresa nova quando o CNPJ já existe (checagem antes de acionar o BPM)", async () => {
    prismaMock.cliente.findUnique.mockResolvedValue({ id: 999 });
    const r = await criarIndicacao({
      parceiroId: 16,
      novaEmpresa: { cnpj: "12.345.678/0001-90", razaoSocial: "Empresa Duplicada Ltda" },
      servicoIndicado: "TTD 409",
    });
    expect(r.success).toBe(false);
    expect(prismaMock.cliente.findUnique).toHaveBeenCalledWith({ where: { cnpj: "12345678000190" }, select: { id: true } });
    expect(criarCardBpmMock).not.toHaveBeenCalled();
    expect(prismaMock.indicacao.create).not.toHaveBeenCalled();
  });

  it("propaga o erro do BPM sem criar a Indicacao quando CriarCardBpm falha", async () => {
    prismaMock.indicacao.findFirst.mockResolvedValue(null);
    criarCardBpmMock.mockResolvedValue({ success: false, error: "Responsável inválido para este pipeline." });
    const r = await criarIndicacao({ parceiroId: 17, clienteId: 504, servicoIndicado: "TTD 409" });
    expect(r.success).toBe(false);
    expect(r).toMatchObject({ error: "Responsável inválido para este pipeline." });
    expect(prismaMock.indicacao.create).not.toHaveBeenCalled();
    expect(direcionarAutomaticoMock).not.toHaveBeenCalled();
  });
});
