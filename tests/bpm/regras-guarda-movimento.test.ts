import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  bpmRegra: { findMany: vi.fn() },
  cliente: { findUnique: vi.fn() },
  bpmCardCampoValor: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import { obterErroRegrasParaMovimento } from "@/lib/bpm/regras/guarda-movimento";

const cardBase = {
  id: "card-1",
  pipelineId: "clxpipeline0000000000000001",
  etapaId: "etapa-origem",
  responsavelId: 1,
  servico: "Serviço X",
  status: "ATIVO",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  concluidoEm: null,
  primeiraVisualizacaoEm: null,
  proximoContatoEm: null,
  dataReuniao: null,
  statusPosFechamento: null,
  empresaId: 7,
};

describe("obterErroRegrasParaMovimento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.cliente.findUnique.mockResolvedValue(null);
    prismaMock.bpmCardCampoValor.findMany.mockResolvedValue([]);
  });

  it("não bloqueia quando não há regras ativas aplicáveis", async () => {
    prismaMock.bpmRegra.findMany.mockResolvedValue([]);

    const erro = await obterErroRegrasParaMovimento({ card: cardBase, etapaDestinoId: "etapa-destino" });

    expect(erro).toBeNull();
  });

  it("bloqueia a movimentação quando uma regra ativa aplicável avalia como não permitida", async () => {
    prismaMock.bpmRegra.findMany.mockResolvedValue([
      {
        id: "regra-1",
        nome: "Status precisa ser ATIVO",
        ativa: true,
        prioridade: 0,
        pipelineId: "clxpipeline0000000000000001",
        etapasJson: null,
        versaoAtualNum: 1,
        versoes: [
          {
            versao: 1,
            condicaoJson: JSON.stringify({
              operador: "AND",
              condicoes: [{ tipo: "condicao", campo: { fonte: "card", campo: "status" }, operador: "igual", valor: "CANCELADO" }],
            }),
            resultadoJson: JSON.stringify({ tipo: "bloqueio_movimentacao", mensagem: "Card cancelado não pode avançar" }),
            createdAt: new Date("2026-01-01T00:00:00Z"),
          },
        ],
      },
    ]);

    const erro = await obterErroRegrasParaMovimento({ card: { ...cardBase, status: "CANCELADO" }, etapaDestinoId: "etapa-destino" });

    expect(erro).toBe("Card cancelado não pode avançar");
  });

  it("ignora regra escopada a outra etapa (etapasJson não contém origem/destino)", async () => {
    prismaMock.bpmRegra.findMany.mockResolvedValue([
      {
        id: "regra-1",
        nome: "Só na etapa Z",
        ativa: true,
        prioridade: 0,
        pipelineId: "clxpipeline0000000000000001",
        etapasJson: JSON.stringify(["etapa-z"]),
        versaoAtualNum: 1,
        versoes: [
          {
            versao: 1,
            condicaoJson: JSON.stringify({ operador: "AND", condicoes: [] }),
            resultadoJson: JSON.stringify({ tipo: "bloqueio_movimentacao", mensagem: "Não deveria bloquear" }),
          },
        ],
      },
    ]);

    const erro = await obterErroRegrasParaMovimento({ card: cardBase, etapaDestinoId: "etapa-destino" });

    expect(erro).toBeNull();
  });

  it("resolve campo dinâmico (BpmCardCampoValor) e bloqueia quando a condição bate", async () => {
    prismaMock.bpmCardCampoValor.findMany.mockResolvedValue([
      { campoId: "clxcampodinamico00000000001", valor: "URGENTE" },
    ]);
    prismaMock.bpmRegra.findMany.mockResolvedValue([
      {
        id: "regra-1",
        nome: "Bloquear quando prioridade dinâmica é URGENTE",
        ativa: true,
        prioridade: 0,
        pipelineId: "clxpipeline0000000000000001",
        etapasJson: null,
        versaoAtualNum: 1,
        versoes: [
          {
            versao: 1,
            condicaoJson: JSON.stringify({
              operador: "AND",
              condicoes: [{ tipo: "condicao", campo: { fonte: "campo_dinamico", campo: "clxcampodinamico00000000001" }, operador: "igual", valor: "URGENTE" }],
            }),
            resultadoJson: JSON.stringify({ tipo: "bloqueio_movimentacao", mensagem: "Prioridade urgente exige revisão manual" }),
            createdAt: new Date("2026-01-01T00:00:00Z"),
          },
        ],
      },
    ]);

    const erro = await obterErroRegrasParaMovimento({ card: cardBase, etapaDestinoId: "etapa-destino" });

    expect(erro).toBe("Prioridade urgente exige revisão manual");
  });

  it("falha fechada quando a avaliação lança uma exceção inesperada", async () => {
    prismaMock.bpmRegra.findMany.mockRejectedValue(new Error("Falha de conexão simulada"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const erro = await obterErroRegrasParaMovimento({ card: cardBase, etapaDestinoId: "etapa-destino" });

    expect(erro).toBe("Não foi possível validar as regras desta transição. Tente novamente ou contate um administrador.");
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
