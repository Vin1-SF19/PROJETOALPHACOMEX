import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  parceiroLead: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  parceiroLeadHistorico: {
    create: vi.fn(),
  },
  parceiroHistorico: {
    create: vi.fn(),
  },
  parceiro: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  usuarios: {
    findMany: vi.fn(),
  },
}));

const getCtxMock = vi.hoisted(() => vi.fn());
const criarParceiroMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
vi.mock("@/actions/parceiros", () => ({ getCtx: getCtxMock, criarParceiro: criarParceiroMock }));

import {
  CriarLeadAquisicaoParceiro,
  MoverLeadAquisicaoParceiro,
  RegistrarSaidaLateralLeadAquisicao,
  AtualizarPotencialLeadAquisicao,
  PromoverLeadParaParceiro,
} from "@/actions/parceiros-aquisicao";

const CTX_EDITOR = { userId: 7, role: "User", isAdmin: false, podeEditar: true, podeExcluir: false, podeAprovar: false };

describe("Aquisição de Parceiros — CriarLeadAquisicaoParceiro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCtxMock.mockResolvedValue(CTX_EDITOR);
  });

  it("rejeita sem permissão", async () => {
    getCtxMock.mockResolvedValue({ ...CTX_EDITOR, isAdmin: false, podeEditar: false });
    const r = await CriarLeadAquisicaoParceiro({ nome: "Fulano" });
    expect(r.success).toBe(false);
    expect(prismaMock.parceiroLead.create).not.toHaveBeenCalled();
  });

  it("cria o lead em NOVO_LEAD e grava histórico", async () => {
    prismaMock.parceiroLead.create.mockResolvedValue({ id: "lead1", status: "NOVO_LEAD", nome: "Fulano" });
    const r = await CriarLeadAquisicaoParceiro({ nome: "Fulano" });
    expect(r.success).toBe(true);
    expect(prismaMock.parceiroLead.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ nome: "Fulano" }) }),
    );
    expect(prismaMock.parceiroLeadHistorico.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ leadId: "lead1", acao: "LEAD_CRIADO" }) }),
    );
  });
});

describe("Aquisição de Parceiros — MoverLeadAquisicaoParceiro (máquina de estados)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCtxMock.mockResolvedValue(CTX_EDITOR);
    prismaMock.$transaction.mockResolvedValue([{}, {}]);
  });

  it("permite avançar 1 etapa", async () => {
    prismaMock.parceiroLead.findUnique.mockResolvedValue({ id: "lead1", status: "NOVO_LEAD" });
    const r = await MoverLeadAquisicaoParceiro({ leadId: "clfake000000000000000000", statusDestino: "EM_PROSPECCAO" });
    expect(r.success).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalled();
  });

  it("rejeita pular 2 etapas de uma vez", async () => {
    prismaMock.parceiroLead.findUnique.mockResolvedValue({ id: "lead1", status: "NOVO_LEAD" });
    const r = await MoverLeadAquisicaoParceiro({ leadId: "clfake000000000000000000", statusDestino: "EM_QUALIFICACAO" });
    expect(r.success).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("permite corrigir para uma etapa anterior", async () => {
    prismaMock.parceiroLead.findUnique.mockResolvedValue({ id: "lead1", status: "REUNIAO_AGENDADA" });
    const r = await MoverLeadAquisicaoParceiro({ leadId: "clfake000000000000000000", statusDestino: "EM_PROSPECCAO" });
    expect(r.success).toBe(true);
  });

  it("rejeita mover diretamente para CADASTRADO (só via promoção)", async () => {
    prismaMock.parceiroLead.findUnique.mockResolvedValue({ id: "lead1", status: "PRE_CADASTRO" });
    // "CADASTRADO" não está no enum do schema de input — a própria validação Zod já barra.
    const r = await MoverLeadAquisicaoParceiro({ leadId: "clfake000000000000000000", statusDestino: "CADASTRADO" });
    expect(r.success).toBe(false);
  });

  it("rejeita mover um lead já terminal (CADASTRADO)", async () => {
    prismaMock.parceiroLead.findUnique.mockResolvedValue({ id: "lead1", status: "CADASTRADO" });
    const r = await MoverLeadAquisicaoParceiro({ leadId: "clfake000000000000000000", statusDestino: "EM_PROSPECCAO" });
    expect(r.success).toBe(false);
  });

  it("permite reingressar de uma saída lateral para qualquer etapa ativa", async () => {
    prismaMock.parceiroLead.findUnique.mockResolvedValue({ id: "lead1", status: "STANDBY" });
    const r = await MoverLeadAquisicaoParceiro({ leadId: "clfake000000000000000000", statusDestino: "NEGOCIACAO_FOLLOWUP" });
    expect(r.success).toBe(true);
  });
});

describe("Aquisição de Parceiros — RegistrarSaidaLateralLeadAquisicao", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCtxMock.mockResolvedValue(CTX_EDITOR);
    prismaMock.$transaction.mockResolvedValue([{}, {}]);
  });

  it("exige motivo com no mínimo 3 caracteres", async () => {
    const r = await RegistrarSaidaLateralLeadAquisicao({ leadId: "clfake000000000000000000", status: "PERDIDO", motivo: "no" });
    expect(r.success).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("registra saída lateral válida a partir de etapa ativa", async () => {
    prismaMock.parceiroLead.findUnique.mockResolvedValue({ id: "lead1", status: "EM_QUALIFICACAO" });
    const r = await RegistrarSaidaLateralLeadAquisicao({ leadId: "clfake000000000000000000", status: "SEM_PERFIL", motivo: "Fora do perfil ideal" });
    expect(r.success).toBe(true);
  });
});

describe("Aquisição de Parceiros — AtualizarPotencialLeadAquisicao (score 0-5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCtxMock.mockResolvedValue(CTX_EDITOR);
    prismaMock.$transaction.mockResolvedValue([{}, {}]);
    prismaMock.parceiroLead.findUnique.mockResolvedValue({ id: "lead1", potencialRecorrencia: null });
  });

  it("aceita 0 e 5 (limites válidos)", async () => {
    const r0 = await AtualizarPotencialLeadAquisicao({ leadId: "clfake000000000000000000", potencialRecorrencia: 0 });
    expect(r0.success).toBe(true);
    const r5 = await AtualizarPotencialLeadAquisicao({ leadId: "clfake000000000000000000", potencialRecorrencia: 5 });
    expect(r5.success).toBe(true);
  });

  it("rejeita valor fora do range 0-5", async () => {
    const r = await AtualizarPotencialLeadAquisicao({ leadId: "clfake000000000000000000", potencialRecorrencia: 6 });
    expect(r.success).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe("Aquisição de Parceiros — PromoverLeadParaParceiro (idempotência e duplicidade)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCtxMock.mockResolvedValue(CTX_EDITOR);
    prismaMock.$transaction.mockResolvedValue([{}, {}, {}, {}]);
  });

  it("rejeita promover um lead já CADASTRADO (idempotência)", async () => {
    prismaMock.parceiroLead.findUnique.mockResolvedValue({ id: "lead1", status: "CADASTRADO", promovidoParceiroId: 99 });
    const r = await PromoverLeadParaParceiro({ leadId: "clfake000000000000000000" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.parceiroId).toBe(99);
    expect(prismaMock.parceiroLead.updateMany).not.toHaveBeenCalled();
    expect(criarParceiroMock).not.toHaveBeenCalled();
  });

  it("exige documento antes de promover e reverte para a etapa original em caso de falha", async () => {
    prismaMock.parceiroLead.findUnique.mockResolvedValue({
      id: "lead1", status: "PRE_CADASTRO", documento: null, email: "lead@teste.com",
      tipo: "PF", nome: "Fulano", telefone: null, potencialRecorrencia: null, segmento: null, origem: null, responsavelId: null,
      promovidoParceiroId: null,
    });
    prismaMock.parceiroLead.updateMany.mockResolvedValue({ count: 1 });
    const r = await PromoverLeadParaParceiro({ leadId: "clfake000000000000000000" });
    expect(r.success).toBe(false);
    expect(prismaMock.parceiroLead.update).toHaveBeenCalledWith({ where: { id: "clfake000000000000000000" }, data: { status: "PRE_CADASTRO" } });
    expect(criarParceiroMock).not.toHaveBeenCalled();
  });

  it("rejeita quando já existe parceiro com o mesmo documento (sem duplicidade)", async () => {
    prismaMock.parceiroLead.findUnique.mockResolvedValue({
      id: "lead1", status: "PRE_CADASTRO", documento: "12345678900", email: "lead@teste.com",
      tipo: "PF", nome: "Fulano", telefone: null, potencialRecorrencia: null, segmento: null, origem: null, responsavelId: null,
      promovidoParceiroId: null,
    });
    prismaMock.parceiroLead.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.parceiro.findUnique.mockResolvedValue({ id: 55 });
    const r = await PromoverLeadParaParceiro({ leadId: "clfake000000000000000000" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.parceiroId).toBe(55);
    expect(criarParceiroMock).not.toHaveBeenCalled();
  });

  it("promove com sucesso e propaga o potencial de recorrência qualificado no lead", async () => {
    prismaMock.parceiroLead.findUnique.mockResolvedValue({
      id: "lead1", status: "PRE_CADASTRO", documento: "12345678900", email: "lead@teste.com",
      tipo: "PF", nome: "Fulano", telefone: "11999999999", potencialRecorrencia: 4, segmento: "Comex", origem: "Indicação",
      responsavelId: 3, promovidoParceiroId: null,
    });
    prismaMock.parceiroLead.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.parceiro.findUnique.mockResolvedValue(null);
    criarParceiroMock.mockResolvedValue({ success: true, parceiro: { id: 200, loginEmail: "lead@teste.com", senhaGerada: "x", nome: "Fulano" } });

    const r = await PromoverLeadParaParceiro({ leadId: "clfake000000000000000000" });
    expect(r.success).toBe(true);
    expect(criarParceiroMock).toHaveBeenCalledWith(
      expect.objectContaining({ documento: "12345678900", email: "lead@teste.com", tipo: "PF" }),
    );
    expect(prismaMock.$transaction).toHaveBeenCalled();
    const chamadaTransacao = prismaMock.$transaction.mock.calls[0][0] as unknown[];
    // 4 operações esperadas: update lead promovido, update parceiro (potencial), historico lead, historico parceiro
    expect(chamadaTransacao.length).toBe(4);
  });
});
