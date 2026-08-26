import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  indicacao: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  parceiroHistorico: {
    create: vi.fn(),
  },
  bpmPipeline: {
    findFirst: vi.fn(),
  },
  bpmEtapa: {
    findFirst: vi.fn(),
  },
  clienteServico: {
    findMany: vi.fn(),
  },
}));

const getCtxMock = vi.hoisted(() => vi.fn());
const criarCardBpmMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/actions/parceiros", () => ({ getCtx: getCtxMock }));
vi.mock("@/actions/bpm/Cards", () => ({ CriarCardBpm: criarCardBpmMock }));

import { DirecionarIndicacaoParaCloser, ListarIndicacoesDoParceiro } from "@/actions/parceiros-indicacoes";

const CTX_EDITOR = { userId: 7, role: "User", isAdmin: false, podeEditar: true, podeExcluir: false, podeAprovar: false };

describe("DirecionarIndicacaoParaCloser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCtxMock.mockResolvedValue(CTX_EDITOR);
    prismaMock.$transaction.mockResolvedValue([{}, {}]);
    prismaMock.bpmPipeline.findFirst.mockResolvedValue({ id: "pipe1" });
    prismaMock.bpmEtapa.findFirst.mockResolvedValue({ id: "etapa1" });
  });

  it("rejeita sem permissão", async () => {
    getCtxMock.mockResolvedValue({ ...CTX_EDITOR, isAdmin: false, podeEditar: false });
    const r = await DirecionarIndicacaoParaCloser({ indicacaoId: 1, responsavelId: 2 });
    expect(r.success).toBe(false);
    expect(criarCardBpmMock).not.toHaveBeenCalled();
  });

  it("rejeita indicação inexistente", async () => {
    prismaMock.indicacao.findUnique.mockResolvedValue(null);
    const r = await DirecionarIndicacaoParaCloser({ indicacaoId: 1, responsavelId: 2 });
    expect(r.success).toBe(false);
  });

  it("rejeita indicação já direcionada (bpmCardId já preenchido)", async () => {
    prismaMock.indicacao.findUnique.mockResolvedValue({ id: 1, clienteId: 10, parceiroId: 3, bpmCardId: "card-existente" });
    const r = await DirecionarIndicacaoParaCloser({ indicacaoId: 1, responsavelId: 2 });
    expect(r.success).toBe(false);
    expect(criarCardBpmMock).not.toHaveBeenCalled();
  });

  it("cria o card no pipeline 'Revisão de Radar', etapa Novos Leads (ordem 0), e vincula bpmCardId", async () => {
    prismaMock.indicacao.findUnique.mockResolvedValue({ id: 1, clienteId: 10, parceiroId: 3, bpmCardId: null });
    criarCardBpmMock.mockResolvedValue({ success: true, data: { id: "card-novo" } });

    const r = await DirecionarIndicacaoParaCloser({ indicacaoId: 1, responsavelId: 2 });

    expect(r.success).toBe(true);
    expect(prismaMock.bpmPipeline.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ nome: "Revisão de Radar" }) }),
    );
    expect(prismaMock.bpmEtapa.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ pipelineId: "pipe1", ordem: 0 }) }),
    );
    expect(criarCardBpmMock).toHaveBeenCalledWith({
      empresaId: 10,
      pipelineId: "pipe1",
      etapaId: "etapa1",
      responsavelId: 2,
    });
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it("propaga erro do CriarCardBpm sem vincular nada", async () => {
    prismaMock.indicacao.findUnique.mockResolvedValue({ id: 1, clienteId: 10, parceiroId: 3, bpmCardId: null });
    criarCardBpmMock.mockResolvedValue({ success: false, error: "Responsável inválido para este pipeline." });

    const r = await DirecionarIndicacaoParaCloser({ indicacaoId: 1, responsavelId: 999 });
    expect(r.success).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("erro amigável quando o pipeline 'Revisão de Radar' não existe/está configurado", async () => {
    prismaMock.indicacao.findUnique.mockResolvedValue({ id: 1, clienteId: 10, parceiroId: 3, bpmCardId: null });
    prismaMock.bpmPipeline.findFirst.mockResolvedValue(null);
    const r = await DirecionarIndicacaoParaCloser({ indicacaoId: 1, responsavelId: 2 });
    expect(r.success).toBe(false);
    expect(criarCardBpmMock).not.toHaveBeenCalled();
  });
});

describe("ListarIndicacoesDoParceiro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCtxMock.mockResolvedValue(CTX_EDITOR);
  });

  it("consolida indicação + oportunidade + contrato mais recente", async () => {
    prismaMock.indicacao.findMany.mockResolvedValue([
      {
        id: 1,
        status: "ATIVA",
        dataIndicacao: new Date("2026-01-01"),
        cliente: { id: 10, razaoSocial: "Empresa X", nomeFantasia: null, cnpj: "123" },
        bpmCardId: "card1",
        bpmCard: { id: "card1", status: "ATIVO", pipelineId: "pipe1", pipeline: { nome: "Revisão de Radar" }, etapa: { nome: "Em tratativa" } },
      },
    ]);
    prismaMock.clienteServico.findMany.mockResolvedValue([
      { clienteId: 10, servico: "Radar", dataContratacao: "2026-02-01", valorContrato: 500 },
    ]);

    const r = await ListarIndicacoesDoParceiro(3);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.indicacoes).toHaveLength(1);
      expect(r.indicacoes[0].oportunidade).toEqual({ id: "card1", status: "ATIVO", pipelineNome: "Revisão de Radar", etapaNome: "Em tratativa" });
      expect(r.indicacoes[0].contrato?.servico).toBe("Radar");
    }
  });

  it("indicação sem oportunidade ainda (bpmCard null) retorna oportunidade:null", async () => {
    prismaMock.indicacao.findMany.mockResolvedValue([
      { id: 2, status: "ATIVA", dataIndicacao: new Date(), cliente: { id: 20, razaoSocial: "Y", nomeFantasia: null, cnpj: null }, bpmCardId: null, bpmCard: null },
    ]);
    prismaMock.clienteServico.findMany.mockResolvedValue([]);

    const r = await ListarIndicacoesDoParceiro(3);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.indicacoes[0].oportunidade).toBeNull();
      expect(r.indicacoes[0].contrato).toBeNull();
    }
  });
});
