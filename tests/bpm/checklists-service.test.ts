import { beforeEach, describe, expect, it, vi } from "vitest";

const historicoMock = vi.hoisted(() => vi.fn());
const realtimeMock = vi.hoisted(() => vi.fn());
const prismaMock = vi.hoisted(() => ({
  bpmCard: { findUnique: vi.fn() },
  bpmChecklistTemplate: { findMany: vi.fn() },
  bpmCardChecklist: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("@/lib/bpm/historico-server", () => ({ registrarHistoricoCard: historicoMock }));
vi.mock("@/lib/bpm/realtime-server", () => ({ notificarPipelineBpm: realtimeMock }));

import { materializarChecklistsAplicaveisCard } from "@/lib/bpm/checklists/service";

const card = {
  id: "card-1",
  pipelineId: "pipeline-1",
  etapaId: "etapa-1",
  servico: "Radar",
  tipoProcesso: "Importação",
};

function template(id: string) {
  return {
    id,
    nome: `Template ${id}`,
    descricao: `Descrição ${id}`,
    itens: [{ id: `item-${id}`, nome: "Documento", descricao: null, obrigatorio: true, ordem: 0 }],
  };
}

describe("serviço de materialização de checklists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.bpmCard.findUnique.mockResolvedValue(card);
  });

  it("percorre todas as páginas de templates aplicáveis sem truncar em 250", async () => {
    const primeiraPagina = Array.from({ length: 250 }, (_, indice) => template(`template-${indice}`));
    const segundaPagina = [template("template-250")];
    prismaMock.bpmChecklistTemplate.findMany
      .mockResolvedValueOnce(primeiraPagina)
      .mockResolvedValueOnce(segundaPagina);
    prismaMock.bpmCardChecklist.findMany
      .mockResolvedValueOnce([...primeiraPagina, ...segundaPagina].map(({ id }) => ({ templateId: id })))
      .mockResolvedValueOnce([]);

    const resultado = await materializarChecklistsAplicaveisCard({ cardId: card.id, usuarioId: 7 });

    expect(resultado.criados).toEqual([]);
    expect(prismaMock.bpmChecklistTemplate.findMany).toHaveBeenCalledTimes(2);
    expect(prismaMock.bpmChecklistTemplate.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      cursor: { id: "template-249" },
      skip: 1,
      take: 250,
    }));
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("materializa snapshot do template e registra histórico na mesma transação", async () => {
    const origem = template("template-1");
    prismaMock.bpmChecklistTemplate.findMany.mockResolvedValueOnce([origem]);
    prismaMock.bpmCardChecklist.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const tx = { bpmCardChecklist: { create: vi.fn().mockResolvedValue({ id: "checklist-1" }) } };
    prismaMock.$transaction.mockImplementation(async (operacao: (client: typeof tx) => Promise<unknown>) => operacao(tx));

    const resultado = await materializarChecklistsAplicaveisCard({ cardId: card.id, usuarioId: 7 });

    expect(resultado.criados).toEqual(["checklist-1"]);
    expect(tx.bpmCardChecklist.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        cardId: card.id,
        templateId: origem.id,
        templateNome: origem.nome,
        templateDescricao: origem.descricao,
        itens: { create: [expect.objectContaining({ templateItemId: "item-template-1", exclusivoCard: false })] },
      }),
      select: { id: true },
    }));
    expect(historicoMock).toHaveBeenCalledWith(expect.objectContaining({ acao: "CHECKLIST_MATERIALIZADO" }), tx);
    expect(realtimeMock).toHaveBeenCalledWith(expect.objectContaining({ cardId: card.id, pipelineId: card.pipelineId }));
  });

  it("trata colisão P2002 como retry idempotente", async () => {
    prismaMock.bpmChecklistTemplate.findMany.mockResolvedValueOnce([template("template-1")]);
    prismaMock.bpmCardChecklist.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prismaMock.$transaction.mockRejectedValue({ code: "P2002" });

    await expect(materializarChecklistsAplicaveisCard({ cardId: card.id })).resolves.toMatchObject({ criados: [] });
    expect(realtimeMock).not.toHaveBeenCalled();
  });
});
