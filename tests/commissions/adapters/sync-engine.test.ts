import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  syncRun: {
    create: vi.fn(),
    update: vi.fn(),
  },
  syncError: {
    create: vi.fn(),
  },
  contratoComercial: {
    findMany: vi.fn(),
  },
  clientes: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  commissionEvent: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  commissionDivergence: {
    create: vi.fn(),
  },
  businessProcess: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import { sincronizarComissoes } from "@/lib/commissions/sync-engine";

function contratoRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "contrato-1",
    cnpj: "12345678000190",
    razaoSocial: "Alpha Import",
    nomeFantasia: null,
    valorContrato: 22000,
    formaPagamento: "A_VISTA_DESCONTO",
    servico: "Revisão de RADAR Ilimitado",
    closerNome: "Sheila",
    usuarioId: 10,
    pagamentoConfirmado: true,
    pagamentoConfirmadoEm: new Date("2026-07-15T00:00:00.000Z"),
    updatedAt: new Date("2026-07-15T00:00:00.000Z"),
    ...overrides,
  };
}

describe("sincronizarComissoes — idempotência e divergência", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.syncRun.create.mockResolvedValue({ id: "sync-run-1" });
    prismaMock.syncRun.update.mockResolvedValue({});
    prismaMock.clientes.findMany.mockResolvedValue([]); // sem êxitos pendentes por padrão
    prismaMock.commissionEvent.findMany.mockResolvedValue([]);
  });

  it("evento de contratação já existente (idempotência): não cria novo CommissionEvent", async () => {
    prismaMock.contratoComercial.findMany.mockResolvedValue([contratoRow()]);
    prismaMock.commissionEvent.findUnique.mockResolvedValue({ id: "evento-existente" }); // já processado

    const result = await sincronizarComissoes({ triggeredBy: "manual" });

    expect(prismaMock.commissionEvent.create).not.toHaveBeenCalled();
    expect(result.totalProcessed).toBe(0);
    expect(result.status).toBe("SUCCESS");
  });

  it("contratação nova (sem evento prévio): cria CommissionEvent uma única vez", async () => {
    prismaMock.contratoComercial.findMany.mockResolvedValue([contratoRow()]);
    prismaMock.commissionEvent.findUnique.mockResolvedValue(null); // ainda não processado
    prismaMock.clientes.findFirst.mockResolvedValue(null); // sem cliente correspondente ainda
    prismaMock.commissionEvent.create.mockResolvedValue({ id: "evento-novo" });

    const result = await sincronizarComissoes({ triggeredBy: "manual" });

    expect(prismaMock.commissionEvent.create).toHaveBeenCalledTimes(1);
    expect(result.totalProcessed).toBe(1);
    expect(result.totalErrors).toBe(0);
  });

  it("dado ausente (falha ao processar 1 contrato) vira SyncError e é registrado, sem derrubar o resto da sincronização", async () => {
    prismaMock.contratoComercial.findMany.mockResolvedValue([contratoRow({ id: "contrato-com-erro" })]);
    prismaMock.commissionEvent.findUnique.mockResolvedValue(null);
    prismaMock.clientes.findFirst.mockRejectedValue(new Error("Falha simulada de leitura"));

    const result = await sincronizarComissoes({ triggeredBy: "manual" });

    expect(prismaMock.syncError.create).toHaveBeenCalledTimes(1);
    expect(result.totalErrors).toBe(1);
    expect(result.status).toBe("FAILED");
  });

  it("êxito detectado (clientes.dataExito preenchida, sem evento prévio) gera CommissionEvent de PROCESS_SUCCESS", async () => {
    prismaMock.contratoComercial.findMany.mockResolvedValue([]);
    prismaMock.clientes.findMany.mockResolvedValue([{ id: 5 }]); // 1 cliente com dataExito não processado
    prismaMock.commissionEvent.findMany.mockResolvedValue([]); // nenhum evento de êxito já existe
    prismaMock.clientes.findUnique.mockResolvedValue({
      id: 5,
      cnpj: "12345678000190",
      razaoSocial: "Alpha Import",
      nomeFantasia: null,
      servicos: "Revisão de RADAR Ilimitado",
      formaPagamento: "A_VISTA_DESCONTO",
      valorContrato: 22000,
      closerNome: "Sheila",
      analistaResponsavel: "Maria",
      dataContratacao: "2026-07-15",
      dataExito: "2026-07-20",
      embasamento: null,
      origemLead: null,
    });
    prismaMock.commissionEvent.create.mockResolvedValue({ id: "evento-exito" });
    prismaMock.businessProcess.findFirst.mockResolvedValue(null); // sem BusinessProcess -> divergência

    const result = await sincronizarComissoes({ triggeredBy: "manual" });

    expect(prismaMock.commissionEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: "PROCESS_SUCCESS", clienteId: 5 }) }),
    );
    expect(prismaMock.commissionDivergence.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: "EXITO_SEM_BUSINESS_PROCESS" }) }),
    );
    expect(result.totalProcessed).toBe(1);
  });

  it("êxito já processado (idempotência): listarClientesComExitoNaoProcessado já filtra, não reprocessa", async () => {
    prismaMock.contratoComercial.findMany.mockResolvedValue([]);
    prismaMock.clientes.findMany.mockResolvedValue([{ id: 5 }]);
    // Simula que já existe evento de êxito para o cliente 5 — filtro deve excluí-lo.
    prismaMock.commissionEvent.findMany.mockResolvedValue([{ clienteId: 5 }]);

    const result = await sincronizarComissoes({ triggeredBy: "manual" });

    expect(prismaMock.clientes.findUnique).not.toHaveBeenCalled();
    expect(result.totalProcessed).toBe(0);
  });
});
