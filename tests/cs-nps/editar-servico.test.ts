import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  clienteServico: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  clienteServicoHistorico: {
    createMany: vi.fn(),
  },
  contratoComercial: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const authMock = vi.hoisted(() => vi.fn());
const revalidatePathMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));

import { analisarImpactoTrocaServico, salvarAlteracoesServico } from "@/actions/Clientes";

const estadoAnterior = {
  id: 31,
  clienteId: 9,
  servico: "Habilitação RADAR - 50K",
  status: "Em Andamento",
  analistaResponsavel: null,
  dataContratacao: null,
  nps: null,
  feedbackGoogle: false,
  nomeGoogle: null,
  embasamento: null,
  origemLead: null,
  dataExito: null,
  formaPagamento: null,
  valorContrato: null,
  closerNome: null,
};

function alteracoes(servico = "Revisão RADAR - 150K") {
  return {
    servico,
    analistaResponsavel: null,
    dataContratacao: null,
    status: "Em Andamento",
    nps: null,
    feedbackGoogle: false,
    nomeGoogle: null,
    embasamento: null,
    origemLead: null,
    dataExito: null,
    formaPagamento: null,
    valorContrato: null,
    closerNome: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { id: "7", nome: "Ana Responsável" } });
  prismaMock.clienteServico.findUnique.mockResolvedValue(estadoAnterior);
  prismaMock.clienteServico.update.mockResolvedValue({ id: estadoAnterior.id });
  prismaMock.clienteServicoHistorico.createMany.mockResolvedValue({ count: 1 });
  prismaMock.contratoComercial.findMany.mockResolvedValue([]);
  prismaMock.contratoComercial.update.mockResolvedValue({ id: "contrato-1" });
  prismaMock.$transaction.mockImplementation(async (fn) => fn({
    clienteServico: prismaMock.clienteServico,
    clienteServicoHistorico: prismaMock.clienteServicoHistorico,
    contratoComercial: prismaMock.contratoComercial,
  }));
});

describe("análise de impacto da troca de serviço", () => {
  it("identifica no servidor um serviço originado no Alpha Metas", async () => {
    prismaMock.contratoComercial.findMany.mockResolvedValue([
      { id: "contrato-1", servico: "  HABILITACAO radar - 50k ", status: "ENVIADO" },
    ]);

    const resultado = await analisarImpactoTrocaServico({
      clienteServicoId: estadoAnterior.id,
      novoServico: "Revisão RADAR - 150K",
    });

    expect(resultado).toEqual({
      success: true,
      impacto: {
        origem: "ALPHA_METAS",
        servicoAnterior: estadoAnterior.servico,
        novoServico: "Revisão RADAR - 150K",
        modulos: ["CS & NPS", "Alpha Metas"],
      },
    });
    expect(prismaMock.contratoComercial.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { clienteId: estadoAnterior.clienteId, arquivado: false },
    }));
  });

  it("classifica como legado quando não existe contrato correspondente", async () => {
    const resultado = await analisarImpactoTrocaServico({
      clienteServicoId: estadoAnterior.id,
      novoServico: "Revisão RADAR - ILIMITADO",
    });

    expect(resultado).toEqual(expect.objectContaining({
      success: true,
      impacto: expect.objectContaining({ origem: "LEGADO", modulos: ["CS & NPS"] }),
    }));
  });
});

describe("persistência da troca de serviço", () => {
  it("atualiza CS & NPS e Alpha Metas na mesma transação quando há vínculo", async () => {
    prismaMock.contratoComercial.findMany.mockResolvedValue([
      { id: "contrato-1", servico: estadoAnterior.servico },
    ]);

    const resultado = await salvarAlteracoesServico(estadoAnterior.id, alteracoes());

    expect(resultado).toEqual({ success: true });
    expect(prismaMock.clienteServico.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: estadoAnterior.id },
      data: expect.objectContaining({ servico: "Revisão RADAR - 150K" }),
    }));
    expect(prismaMock.contratoComercial.update).toHaveBeenCalledWith({
      where: { id: "contrato-1" },
      data: { servico: "Revisão RADAR - 150K" },
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/PainelAlpha/CadastroClientes");
    expect(revalidatePathMock).toHaveBeenCalledWith("/PainelAlpha/Metas");
  });

  it("altera somente CS & NPS para cliente legado", async () => {
    const resultado = await salvarAlteracoesServico(estadoAnterior.id, alteracoes());

    expect(resultado).toEqual({ success: true });
    expect(prismaMock.clienteServico.update).toHaveBeenCalled();
    expect(prismaMock.contratoComercial.update).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalledWith("/PainelAlpha/Metas");
  });

  it("não informa sucesso quando a atualização do Alpha Metas falha", async () => {
    prismaMock.contratoComercial.findMany.mockResolvedValue([
      { id: "contrato-1", servico: estadoAnterior.servico },
    ]);
    prismaMock.contratoComercial.update.mockRejectedValue(new Error("falha metas"));

    const resultado = await salvarAlteracoesServico(estadoAnterior.id, alteracoes());

    expect(resultado).toEqual(expect.objectContaining({ success: false }));
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("retorna mensagem clara quando o novo serviço duplicaria outro card", async () => {
    prismaMock.clienteServico.update.mockRejectedValue({ code: "P2002" });

    const resultado = await salvarAlteracoesServico(estadoAnterior.id, alteracoes());

    expect(resultado).toEqual({
      success: false,
      error: "Este cliente já possui o novo serviço contratado",
    });
  });
});
