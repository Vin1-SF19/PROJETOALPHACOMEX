import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execucaoUpdateMany: vi.fn(),
  execucaoFindMany: vi.fn(),
  execucaoFindUnique: vi.fn(),
  execucaoUpdate: vi.fn(),
  anexoFindUnique: vi.fn(),
  anexoCreate: vi.fn(),
  historicoCreate: vi.fn(),
  transaction: vi.fn(),
  gerarFicha: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@vercel/blob", () => ({ put: vi.fn() }));
vi.mock("resend", () => ({ Resend: vi.fn() }));
vi.mock("@/lib/bibble/gerar-ficha-server", () => ({
  gerarFichaServer: mocks.gerarFicha,
}));
vi.mock("@/lib/gerador-documentos/pdf", () => ({ gerarPdfDocumento: vi.fn() }));
vi.mock("@/lib/gerador-documentos/render", () => ({ renderizarConteudo: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    bpmAutomacaoExecucao: {
      updateMany: mocks.execucaoUpdateMany,
      findMany: mocks.execucaoFindMany,
      findUnique: mocks.execucaoFindUnique,
      update: mocks.execucaoUpdate,
    },
    bpmCardAnexo: {
      findUnique: mocks.anexoFindUnique,
      create: mocks.anexoCreate,
    },
    bpmCardHistorico: { create: mocks.historicoCreate },
    $transaction: mocks.transaction,
  },
}));

import { processarFilaAutomacoesBpm } from "@/lib/bpm/automacoes/executor";

describe("worker das automações BPM", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.execucaoUpdateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    mocks.execucaoFindMany.mockResolvedValue([{ id: "execucao-1" }]);
    mocks.execucaoFindUnique.mockResolvedValue({
      id: "execucao-1",
      cardId: "card-1",
      automacaoId: "automacao-1",
      automacao: {
        id: "automacao-1",
        nome: "Ficha cadastral",
        ativa: true,
        acaoTipo: "GERAR_FICHA",
        parametrosJson: "{}",
        criadoPorId: 7,
      },
      card: {
        id: "card-1",
        servico: "Assessoria",
        empresaId: 42,
        empresa: {
          razaoSocial: "Alpha Comércio Ltda",
          nomeFantasia: "Alpha",
          cnpj: "12345678000190",
        },
        responsavel: { nome: "Pessoa Responsável" },
        pipeline: { nome: "Comercial" },
        etapa: { nome: "Proposta" },
      },
    });
    mocks.gerarFicha.mockResolvedValue({
      url: "https://blob.example/ficha.pdf",
      fileName: "ficha.pdf",
    });
    mocks.anexoFindUnique.mockResolvedValue(null);
    mocks.anexoCreate.mockResolvedValue({ id: "anexo-1" });
    mocks.execucaoUpdate.mockResolvedValue({ id: "execucao-1" });
    mocks.historicoCreate.mockResolvedValue({ id: "historico-1" });
    mocks.transaction.mockImplementation((operacoes) => Promise.all(operacoes));
  });

  it("faz claim, gera a ficha, anexa ao card e registra sucesso", async () => {
    const resultado = await processarFilaAutomacoesBpm(10);
    expect(mocks.gerarFicha).toHaveBeenCalledWith({
      cnpj: "12345678000190",
      userName: "Pessoa Responsável",
      nomeResponsavel: "Pessoa Responsável",
    });
    expect(mocks.anexoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cardId: "card-1",
        url: "https://blob.example/ficha.pdf",
        enviadoPorId: 7,
      }),
      select: { id: true },
    });
    expect(mocks.execucaoUpdate).toHaveBeenCalledWith({
      where: { id: "execucao-1" },
      data: expect.objectContaining({ status: "SUCESSO", mensagemErro: null }),
    });
    expect(mocks.historicoCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cardId: "card-1",
        acao: "AUTOMACAO_EXECUTADA",
        automacaoOrigem: "automacao-1",
      }),
    });
    expect(resultado).toEqual({ encontrados: 1, executados: 1, falhos: 0 });
  });
});
